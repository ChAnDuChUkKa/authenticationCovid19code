//importing and creating instance
const express = require("express");
const app = express();

//importing sqlite and sqlite3
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

//importing path and creating path
const path = require("path");
const dataPath = path.join(__dirname, "covid19IndiaPortal.db");

//importing jsonwebtoken
const jwt = require("jsonwebtoken");

//default express middleware function
app.use(express.json());

//importing bcrypt
const bcrypt = require("bcrypt");

//initialize database
let dataBase;

//initializing database and server
const initializeDatabaseAndServer = async () => {
  try {
    dataBase = await open({
      filename: dataPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at localhost 3000");
    });
  } catch (error) {
    console.log("error");
    process.exit(1);
  }
};
initializeDatabaseAndServer();

//creating outputFormat
const outputFormatForStates = (dbQuery) => {
  return {
    stateId: dbQuery.state_id,
    stateName: dbQuery.state_name,
    population: dbQuery.population,
  };
};

const outputFormatForDistricts = (dbQuery) => {
  return {
    districtId: dbQuery.district_id,
    districtName: dbQuery.district_name,
    stateId: dbQuery.state_id,
    cases: dbQuery.cases,
    cured: dbQuery.cured,
    active: dbQuery.active,
    deaths: dbQuery.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken=null;
  const headerLine = request.headers["authorization"];
  if (headerLine !== undefined) {
    jwtToken = headerLine.split(" ")[1];
    if (jwtToken !== undefined) {
      jwt.verify(jwtToken, "chandu", async (error, payLoad) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
    } else {
      response.status(401);
      response.send("Invalid JWT Token");
    }
  }else{
    response.status(401);
      response.send("Invalid JWT Token");
}

//creating API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const dbUserQuery = `
  select * from user where
  username='${username}'
  `;
  const dbUser = await dataBase.get(dbUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatch = await bcrypt.compare(password, dbUser.password);
    if (passwordMatch) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "chandu");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//creating API2
app.get("/states/", authenticateToken, async (request, response) => {
  const getQuery = `
    select * from state
    `;
  const getResponse = await dataBase.all(getQuery);
  response.send(
    getResponse.map((eachState) => outputFormatForStates(eachState))
  );
});

//creating API3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `
    select * from state where state_id=${stateId}
    `;
  const getResponse = await dataBase.get(getQuery);
  response.send(outputFormatForStates(getResponse));
});

//creating API4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
    insert into district(district_name,state_id,cases,cured,active,deaths)
    values(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    )
    `;
  await dataBase.run(postQuery);
  response.send("District Successfully Added");
});

//creating API5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `
    select * from district where
    district_id=${districtId}
    `;
    const getResponse = await dataBase.get(getQuery);
    response.send(outputFormatForDistricts(getResponse));
  }
);

//creating API 6
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    delete from district
    where district_id=${districtId}
    `;
    await dataBase.run(deleteQuery);
    response.send("District Removed");
  }
);

//creating API7
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putQuery = `
    update district set
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    where district_id=${districtId}
    `;
    await dataBase.run(putQuery);
    response.send("District Details Updated");
  }
);

//creating API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `
    select sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths from district
    where state_id=${stateId}
    `;
    const getResponse = await dataBase.get(getQuery);
    response.send({
      totalCases: getResponse.totalCases,
      totalCured: getResponse.totalCured,
      totalActive: getResponse.totalActive,
      totalDeaths: getResponse.totalDeaths,
    });
  }
);

module.exports = app;
