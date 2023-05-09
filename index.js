require("./utils.js");
const validator = require("validator");
const mongoose = require("mongoose");

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const saltRounds = 12;

const port = process.env.PORT || 3003;

const app = express();

const Joi = require("joi");

const expireTime = 60 * 60 * 1000; //expires after 1 hour  (minutes * seconds * milliseconds)

const fs = require("fs");
const path = require("path");

let ejs = require("ejs");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var { database } = include("databaseConnection");

const userCollection = database.db(mongodb_database).collection("users");

app.use(express.urlencoded({ extended: false }));

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

app.use(
  session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store
    saveUninitialized: false,
    resave: true,
  })
);


// function to change isAdmin to true for a specific user
async function promoteUser(username) {
  const result = await userCollection.updateOne(
    { username: username }, // filter by username
    { $set: { isAdmin: true } } // set isAdmin to true
  );
  console.log(`${result.modifiedCount} user updated with isAdmin field`);
}

// change user X to admin
promoteUser("admin");

// function to change isAdmin to false for a specific user
async function demoteUser(username) {
  const result = await userCollection.updateOne(
    { username: username }, // filter by username
    { $set: { isAdmin: false } } // set isAdmin to false
  );
  console.log(`${result.modifiedCount} user updated with isAdmin field`);
}

// function to delete a user
async function deleteUser(username) {
  const result = await userCollection.deleteOne(username);
  console.log(`${result.deletedCount} users deleted`);
}

// function to delete all users
async function deleteAllUsers() {
  const result = await userCollection.deleteMany({});
  console.log(`${result.deletedCount} users deleted`);
}

// EJS for home page
app.get("/", (req, res) => {
  const currentPage = "home";
  res.render("index.ejs", { currentPage });
});

// EJS version of nosql-injection
app.get("/nosql-injection", async (req, res) => {
  const username = req.query.user;
  let error = null;

  if (!username) {
    // No user provided, set error message
    error =
      "no user provided - try /nosql-injection?user=name or /nosql-injection?user[$ne]=name";
  } else {
    // User provided, validate with Joi
    const schema = Joi.string().max(20).required();
    const validationResult = schema.validate(username);

    if (validationResult.error != null) {
      // Validation failed, set error message
      error = "A NoSQL injection attack was detected!!";
    }
  }

  res.render("nosql-injection.ejs", { username, error });
});

// EJS version of about
app.get("/about", (req, res) => {
  const color = req.query.color || "black";
  const currentPage = "about";
  res.render("about", { color, currentPage });
});

// EJS Contact route
app.get("/contact", (req, res) => {
  const missingEmail = req.query.missing;
  const currentPage = "contact";
  res.render("contact", { missingEmail, currentPage });
});

// EJS version of submitEmail
app.post("/submitEmail", (req, res) => {
  var email = req.body.email;

  if (!email) {
    res.redirect("/contact?missing=1");
  } else {
    res.render("thankyou", { email: email });
  }
});

// EJS version of createUser
app.get("/createUser", (req, res) => {
  const currentPage = "createUser";
  res.render("createUser", {
    pageTitle: "Sign Up",
    pageCSS:
      "background-color: black; background-repeat: no-repeat; background-size: cover;",
    inputName1: "username",
    inputName2: "password",
    inputName3: "email",
    inputType1: "text",
    inputType2: "password",
    inputType3: "text",
    inputPlaceholder1: "username",
    inputPlaceholder2: "password",
    inputPlaceholder3: "email",
    buttonText: "Submit",
    currentPage,
  });
});

// EJS version of login
app.get("/login", (req, res) => {
  const currentPage = "login";
  res.render("login.ejs", {currentPage});
});

// EJS version of submitUser
app.post("/submitUser", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;

  const schema = Joi.object({
    username: Joi.string().alphanum().max(20).required(),
    password: Joi.string().max(20).required(),
    email: Joi.string().email().required(),
  });

  const validationResult = schema.validate({ username, password, email });
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/createUser");
    return;
  }

  var hashedPassword = await bcrypt.hash(password, saltRounds);

  await userCollection.insertOne({
    username: username,
    password: hashedPassword,
    email: email,
    isAdmin: false,
    images: [],
  });
  console.log("Inserted user");

  res.render("userCreated", { username: username });
});

app.get("/createUser", (req, res) => {
  const currentPage = "createUser";
  res.render("createUser", {currentPage});
});

app.get("/login", (req, res) => {
  const currentPage = "login";
  res.render("login", {currentPage});
});

// // original version of loggingin
app.post("/loggingin", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  // add email
  var email = req.body.email;

  const schema = Joi.string().max(20).required();
  const validationResult = schema.validate(username);

  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/login");

    return;
  }

  const result = await userCollection
    .find({ username: username })
    .project({ username: 1, password: 1, _id: 1 })
    .toArray();

  console.log(result);
  if (result.length != 1) {
    console.log("user not found");
    res.render("invalidUsername");
    return;
  }

  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.authenticated = true;
    req.session.username = username;
    req.session.cookie.maxAge = expireTime;

    res.redirect("/loggedIn");
    return;
  } else {
    console.log("incorrect password");
    res.render("invalidPassword");
    return;
  }
});

// TEST NEW VERSION OF LOGGEDIN
app.get("/loggedIn", async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  var username = req.session.username;
  const user = await userCollection.findOne({ username: username });

  try {
    //const user = await userCollection.findOne({ username: "abc" });

    if (user) {
      console.log(`isAdmin status for user is: ${user.isAdmin}`);
    } else {
      console.log("User not found");
    }
  } catch (error) {
    console.error(error);
  }

  if (user.isAdmin) {
    res.redirect("/admin");
  } else {
    res.redirect("/members");
  }
});

// ADMIN route with EJS that displays all users V3
app.get("/admin", async (req, res) => {
  // if not logged in, redirect to login page
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  // if logged in but not admin, redirect to 403 page
  var username = req.session.username;
  const user = await userCollection.findOne({ username: username });
  if (!user.isAdmin) {
    //res.render("403",);
    res.redirect("/403");
    return
  }

  // if logged in and admin, display all users
  const currentPage = "admin";
  const users = await userCollection.find().toArray();
  res.render("admin", { users, currentPage }); // render the admin EJS page and pass in the users variable
});

// members page with EJS NEW VERSION WITH 3 IMAGES
app.use(express.static("public")); // <--- this uses the 'RELATIVE' path; THAT'S WHY IT WORKS
app.get("/members", (req, res) => {
  const currentPage = "members";
  if (!req.session.username) {
    res.redirect("/login");
    return;
  }

  const imgDir = path.join(__dirname, "public/img");
  fs.readdir(imgDir, (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).send("Server error");
      return;
    }

    // Retrieve three random files from the directory
    const randomFiles = getRandomFiles(files, 3);

    res.render("members", {
      username: req.session.username,
      images: randomFiles.map((file) => `/img/${file}`),
      currentPage,
    });
  });
});

// Helper function to retrieve random files from an array
function getRandomFiles(files, count) {
  const shuffled = files.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// promoteUser route working
app.post("/promoteUser", async (req, res) => {
  var username = req.body.username;
  await promoteUser(username);
  res.redirect("/admin"); // redirect to the admin page
});

// demote user route
app.post("/demoteUser", async (req, res) => {
  var username = req.body.username;
  await demoteUser(username);
  res.redirect("/admin"); // redirect to the admin page
});

// EJS version of logout
app.get("/logout", (req, res) => {
  const currentPage = "logout";
  req.session.destroy();
  res.render("logout", {currentPage});
});

app.get("/cat/:id", (req, res) => {
  var cat = req.params.id;

  if (cat == 1) {
    res.send("Fluffy: <img src='/fluffy.gif' style='width:250px;'>");
  } else if (cat == 2) {
    res.send("Socks: <img src='/socks.gif' style='width:250px;'>");
  } else {
    res.send("Invalid cat id: " + cat);
  }
});

app.use(express.static(__dirname + "/public"));

app.get("/403", (req, res) => {
  const currentPage = "403";
  res.render("403", { currentPage });
});


app.get("*", (req, res) => {
  const currentPage = "*";
  res.render("404", {currentPage});
});


// // change user ABC to admin
// promoteUser("abc");

app.listen(port, () => {
  console.log("Node application listening on port " + port);
});
