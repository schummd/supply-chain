const host = "localhost";
const user = "Cindy";
const password = "123456789";
const database = "6452project";

const Importer = require("mysql-import");
const importer = new Importer({ host, user, password, database });
var mysql = require("mysql");

var con = mysql.createConnection({
  host: "localhost",
  user: "Cindy",
  password: "123456789",
  database: "product",
});

async function workWithDB() {
  await importer
    .import("D:/研究生/COMP6452/supply-chain-extra_tests/product.sql")
    .then(() => {
      var files_imported = importer.getImported();
      console.log(`${files_imported.length} SQL file(s) imported.`);
    })
    .catch((err) => {
      console.error(err);
    });
  await importer
    .import("D:/研究生/COMP6452/supply-chain-extra_tests/conditions.sql")
    .then(() => {
      var files_imported = importer.getImported();
      console.log(`${files_imported.length} SQL file(s) imported.`);
    })
    .catch((err) => {
      console.error(err);
    });
  con.connect(function (err) {
    if (err) throw err;
    con.query("SELECT * FROM product", function (err, result, fields) {
      if (err) throw err;
      Object.keys(result).forEach(function (key) {
        var row = result[key];
        console.log(row);
      });
    });
    con.query("SELECT * FROM conditions", function (err, result, fields) {
      if (err) throw err;
      Object.keys(result).forEach(function (key) {
        var row = result[key];
        console.log(row);
      });
    });
  });
}

workWithDB();
