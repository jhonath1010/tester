/**
 * Author: Jhonatan Lopez Olguin
 * Project: E-commerce App
 * Description: Express server with EJS rendering, MongoDB authentication, session handling,
 *              Cloudinary image uploads, and protected admin routes for item/category management.
 * Technologies: Node.js, Express, MongoDB, Mongoose, Cloudinary, client-sessions, EJS
 * Repository: https://github.com/jhonath1010/web322-app
 */

const express = require('express');
const path = require('path');
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const expressEjsLayouts = require('express-ejs-layouts');
const storeService = require('./store-service.js');
const authData = require('./auth-service');
const clientSessions = require('client-sessions');

const app = express();
const upload = multer();
const HTTP_PORT = process.env.PORT || 8080;

// Cloudinary Configuration
cloudinary.config({
  cloud_name: "dqcbey2fr",
  api_key: "465325822784863",
  api_secret: "GHqyVmEiERQYd13Ln1OVtTl_FVk",
  secure: true
});

// EJS View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressEjsLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(clientSessions({
  cookieName: "session",
  secret: "web322_assignment6_secret_key",
  duration: 2 * 60 * 1000,
  activeDuration: 1000 * 60
}));

// Expose session to views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Set active route and category for UI highlighting
app.use((req, res, next) => {
  let route = req.path.substring(1);
  res.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
  res.locals.viewingCategory = req.query.category;
  next();
});

// Format date for EJS templates
app.locals.formatDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Middleware to protect routes
function ensureLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Routes
app.get('/', (req, res) => res.redirect('/shop'));
app.get('/about', (req, res) => res.render('about'));

// Shop route with optional category filter
app.get('/shop', async (req, res) => {
  try {
    const items = req.query.category
      ? await storeService.getPublishedItemsByCategory(req.query.category)
      : await storeService.getPublishedItems();
    const categories = await storeService.getCategories();
    res.render("shop", { data: { items, categories } });
  } catch {
    res.render("shop", { data: { message: "no results", categories: [] } });
  }
});

// View a single shop item
app.get('/shop/:id', async (req, res) => {
  try {
    const item = await storeService.getItemById(req.params.id);
    const items = await storeService.getPublishedItems();
    const categories = await storeService.getCategories();
    res.render("shop", { data: { item, items, categories } });
  } catch {
    res.render("shop", { data: { message: "no results", categories: [] } });
  }
});

// Admin: view items with filters
app.get('/items', ensureLogin, async (req, res) => {
  try {
    const { category, minDate } = req.query;
    let items = category
      ? await storeService.getItemsByCategory(category)
      : minDate
      ? await storeService.getItemsByMinDate(minDate)
      : await storeService.getAllItems();

    res.render("items", items.length ? { items } : { message: "no results" });
  } catch {
    res.render("items", { message: "no results" });
  }
});

// API route to get a single item in JSON
app.get('/item/:id', (req, res) => {
  storeService.getItemById(req.params.id)
    .then(item => res.json(item))
    .catch(err => res.status(500).json({ message: err }));
});

// Admin: view categories
app.get('/categories', ensureLogin, async (req, res) => {
  try {
    const categories = await storeService.getCategories();
    res.render("categories", categories.length ? { categories } : { message: "no results" });
  } catch {
    res.render("categories", { message: "no results" });
  }
});

app.get('/categories/add', ensureLogin, (req, res) => res.render('addCategory'));

// Add category (POST)
app.post('/categories/add', ensureLogin, (req, res) => {
  storeService.addCategory(req.body)
    .then(() => res.redirect('/categories'))
    .catch(() => res.status(500).send("Unable to Add Category"));
});

// Delete category by ID
app.get('/categories/delete/:id', ensureLogin, (req, res) => {
  storeService.deleteCategoryById(req.params.id)
    .then(() => res.redirect('/categories'))
    .catch(() => res.status(500).send("Unable to Remove Category / Category not found"));
});

// Add item form
app.get('/items/add', ensureLogin, (req, res) => {
  storeService.getCategories()
    .then(data => res.render('addItem', { categories: data }))
    .catch(() => res.render('addItem', { categories: [] }));
});

// Add item with optional image upload
app.post('/items/add', ensureLogin, upload.single("featureImage"), (req, res) => {
  const processItem = (imageUrl) => {
    req.body.featureImage = imageUrl;
    storeService.addItem(req.body)
      .then(() => res.redirect('/items'))
      .catch(err => {
        console.error("Error adding item:", err);
        res.status(500).send("Item Creation Error");
      });
  };

  if (req.file) {
    const streamUpload = (req) => new Promise((resolve, reject) => {
      let stream = cloudinary.uploader.upload_stream((error, result) => {
        result ? resolve(result) : reject(error);
      });
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    (async () => {
      try {
        const uploaded = await streamUpload(req);
        processItem(uploaded.url);
      } catch (err) {
        console.error("Upload failed:", err);
        res.status(500).send("Upload Error");
      }
    })();
  } else {
    processItem("");
  }
});

// Delete item by ID
app.get('/items/delete/:id', ensureLogin, (req, res) => {
  storeService.deleteItemById(req.params.id)
    .then(() => res.redirect('/items'))
    .catch(() => res.status(500).send("Unable to Remove Item / Item not found"));
});

// Authentication Routes
app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));

// Register new user
app.post('/register', (req, res) => {
  authData.registerUser(req.body)
    .then(() => res.render('register', { successMessage: "User created" }))
    .catch(err => res.render('register', { errorMessage: err, userName: req.body.userName }));
});

// Login user
app.post('/login', (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  authData.checkUser(req.body)
    .then(user => {
      req.session.user = {
        userName: user.userName,
        email: user.email,
        loginHistory: user.loginHistory
      };
      res.redirect('/items');
    })
    .catch(err => res.render('login', { errorMessage: err, userName: req.body.userName }));
});

app.get('/logout', (req, res) => {
  req.session.reset();
  res.redirect('/');
});

// View login history
app.get('/userHistory', ensureLogin, (req, res) => res.render('userHistory'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Start server after initializing services
storeService.initialize()
  .then(authData.initialize)
  .then(() => {
    app.listen(HTTP_PORT, () => {
      console.log("Express http server listening on port", HTTP_PORT);
    });
  })
  .catch(err => {
    console.error('Error initializing data:', err);
    process.exit(1);
  });
