const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const port = process.env.PORT || 8080;
const db = require("./server/db/database");
const cors = require("cors");
const deduplicate = require("./server/service/cartSvc");

app.use(express.static(path.join(__dirname, "build")));

app.use(cors());

app.get("/health", function (req, res) {
  return res.send("ok");
});

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// Get product info API
app.get("/product", function (req, res) {
  db.all("SELECT * FROM product WHERE `obsoleted` == false", (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(200).json({ data: rows });
  });
});

//Get membership info
app.get("/membership", function (req, res) {
  let grade = req.query.grade;
  let sql = `SELECT * FROM membership`;
  if (grade) {
    sql = `SELECT * FROM membership WHERE grade == '${grade}'`;
  }

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(200).json({ data: rows });
  });
});

// Add product to cart API with query params productId (Added quantity to response)
app.post("/cart", function (req, res) {
  if (typeof req.query.productId === "undefined") {
    res.status(400).json({ error: "Missing query param - productId" });
    return;
  }

  db.all(
    // Check if product exists in cart
    `SELECT * FROM cart_item WHERE product_id == ${req.query.productId}`,
    (err, row) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }

      if (row.length > 0) {
        // Product exists in cart - add quantity
        db.all(
          `UPDATE cart_item SET quantity = ${row[0].quantity + 1} WHERE id == ${
            row[0].id
          }`
        );
      } else {
        // New product in cart
        db.all(
          `INSERT INTO cart_item (product_id) VALUES (${req.query.productId})`
        );
      }

      db.all(
        `SELECT p.id,p.name,p.price,ct.quantity FROM cart_item ct INNER JOIN product p on ct.product_id = p.id`,
        (err, rows) => {
          res.status(201).json({ data: rows });
        }
      );
    }
  );
});

// Get cart's product (Added quantity to response)
app.get("/cart", function (req, res) {
  db.all(
    `SELECT p.id,p.name,p.price,ct.quantity FROM cart_item ct INNER JOIN product p on ct.product_id = p.id`,
    (err, rows) => {
      const result = deduplicate(rows);

      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(200).json({ data: result });
    }
  );
});

// Delete cart's product (Added quantity to response)
app.delete("/cart", function (req, res) {
  db.run(`DELETE FROM cart_item`, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
  });

  db.all(
    `SELECT p.id,p.name,p.price,ct.quantity FROM cart_item ct INNER JOIN product p on ct.product_id = p.id`,
    (err, rows) => {
      res.status(201).json({ data: rows });
    }
  );
});

app.listen(port, () => {
  console.log(`Start listening on port ${port}...`);
});

module.exports = { app };
