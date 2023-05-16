


const paginate = async (currentPage, PAGE_SIZE, pokemons) => {
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = currentPage * PAGE_SIZE;
  const selected_pokemons = pokemons.slice(startIndex, endIndex);

  $("#pokeCards").empty();

  selected_pokemons.forEach(async (pokemon) => {
    const res = await axios.get(pokemon.url);
    $("#pokeCards").append(`
      <div class="pokeCard card" pokeName=${res.data.name}>
        <h6>${res.data.name.toUpperCase()}</h6>
        <img src="${res.data.sprites.front_default}" alt="${res.data.name}"/>
        <button type="button" class="btn btn-primary" data-toggle="modal" data-target="#pokeModal">
          More
        </button>
      </div>
    `);
  });

  // Calculate the number of pages
  const numPages = Math.ceil(pokemons.length / PAGE_SIZE);

  // Clear the pagination div
  $("#pagination").empty();

  // Add the previous button if current page is not the first page
  if (currentPage > 1) {
    $("#pagination").append(`
      <button class="btn btn-primary page ml-1 numberedButtons" value="${
        currentPage - 1
      }">Prev</button>
    `);
  }

  // Add the page buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(startPage + 4, numPages);

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? "active" : "";
    $("#pagination").append(`
      <button class="btn btn-primary page ml-1 numberedButtons ${activeClass}" value="${i}">${i}</button>
    `);
  }

  // Add the next button if current page is not the last page
  if (currentPage < numPages) {
    $("#pagination").append(`
      <button class="btn btn-primary page ml-1 numberedButtons" value="${
        currentPage + 1
      }">Next</button>
    `);
  }

  // Update the display count
  const totalPokemons = pokemons.length;
  const displayedPokemons = selected_pokemons.length;
  $("#displayCount").text(`${displayedPokemons} out of ${totalPokemons}`);
};

const displayedPokemons = async () => {
  $("#pokeCards").empty();
  const checkedTypes = [];

  $('#pokeTypesFilter input[type="checkbox"]').each(function () {
    if ($(this).is(":checked")) {
      checkedTypes.push($(this).val());
    }
  });

  if (checkedTypes.length === 0) {
    const response = await axios.get(
      "https://pokeapi.co/api/v2/pokemon?offset=0&limit=810"
    );
    pokemons = response.data.results.map((pokemon) => ({
      name: pokemon.name,
      url: pokemon.url,
    }));
  } else {
    const fetchPokemonByType = async (typeId) => {
      const apiUrl = `https://pokeapi.co/api/v2/type/${typeId}`;
      const response = await axios.get(apiUrl);
      return response.data.pokemon.map((entry) => entry.pokemon);
    };

    const fetchPokemonForTypes = async (checkedTypes) => {
      const promises = checkedTypes.map((typeId) => fetchPokemonByType(typeId));
      const pokemonArrays = await Promise.all(promises);

      const intersection = pokemonArrays.reduce((a, b) =>
        a.filter((c) => b.some((d) => d.name === c.name))
      );

      const uniquePokemonsMap = new Map();
      intersection.forEach((pokemon) => {
        uniquePokemonsMap.set(pokemon.name + pokemon.url, pokemon);
      });

      const uniquePokemons = Array.from(uniquePokemonsMap.values());

      return uniquePokemons;
    };

    const intersectionPokemon = await fetchPokemonForTypes(checkedTypes);
    pokemons = intersectionPokemon.map((item) => ({
      name: item.name,
      url: item.url,
    }));
  }
};

const setup = async () => {
  // Connect to Pokémon API and display checkboxes
  try {
    const response = await axios.get("https://pokeapi.co/api/v2/type");
    const types = response.data.results;

    const checkboxes = types.map((type) => {
      const checkboxId = `${type.name}Checkbox`;
      return `
      <label for="${checkboxId}">
        <input type="checkbox" id="${checkboxId}" value="${type.url
        .split("/")
        .slice(-2, -1)}">${type.name}
      </label>
    `;
    });

    $("#pokeTypesFilter").html(checkboxes.join(""));
  } catch (error) {
    console.log("Error fetching Pokémon types:", error);
  }

  $("#pokeCards").empty();
  currentPage = 1;
  const PAGE_SIZE = 10;
  await displayedPokemons();
  paginate(currentPage, PAGE_SIZE, pokemons);

  // pop up modal when clicking on a pokemon card
  // add event listener to each pokemon card
  $("body").on("click", ".pokeCard", async function (e) {
    const pokemonName = $(this).attr("pokeName");
    // console.log("pokemonName: ", pokemonName);
    const res = await axios.get(
      `https://pokeapi.co/api/v2/pokemon/${pokemonName}`
    );
    // console.log("res.data: ", res.data);
    const types = res.data.types.map((type) => type.type.name);
    // console.log("types: ", types);
    $(".modal-body").html(`
        <div style="width:200px">
        <img src="${
          res.data.sprites.other["official-artwork"].front_default
        }" alt="${res.data.name}"/>
        <div>
        <h3>Abilities</h3>
        <ul>
        ${res.data.abilities
          .map((ability) => `<li>${ability.ability.name}</li>`)
          .join("")}
        </ul>
        </div>

        <div>
        <h3>Stats</h3>
        <ul>
        ${res.data.stats
          .map((stat) => `<li>${stat.stat.name}: ${stat.base_stat}</li>`)
          .join("")}
        </ul>

        </div>

        </div>
          <h3>Types</h3>
          <ul>
          ${types.map((type) => `<li>${type}</li>`).join("")}
          </ul>
      
        `);
    $(".modal-title").html(`
        <h2>${res.data.name.toUpperCase()}</h2>
        <h5>${res.data.id}</h5>
        `);
  });

  // add event listener to pagination buttons
  $("body").on("click", ".numberedButtons", async function (e) {
    currentPage = Number(e.target.value);
    paginate(currentPage, PAGE_SIZE, pokemons);
  });

  // add event listener for checkboxes
  $("body").on(
    "click",
    "#pokeTypesFilter input[type='checkbox']",
    async function (e) {
      // currentPage = Number(e.target.value);
      currentPage = 1;
      const PAGE_SIZE = 10;
      await displayedPokemons();

      // await setup();
      paginate(currentPage, PAGE_SIZE, pokemons);
    }
  );
};

$(document).ready(setup);
