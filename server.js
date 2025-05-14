/*********************************************************************************
* WEB322 – Assignment 06
* I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part of this
* assignment has been copied manually or electronically from any other source (including web sites) or
* distributed to other students.
*
* Name: Jhonatan Lopez Olguin
* Student ID: 147028237
* Date: 5 March 2025
*
* Cyclic Web App URL: https://replit.com/@JhonatanLopez6/web322-app?v=1
* GitHub Repository URL: https://github.com/jhonath1010/web322-app
********************************************************************************/
//Required modules
const express = require('express');
const path = require('path');
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const expressEjsLayouts = require('express-ejs-layouts');
const storeService = require('./store-service.js');

//Modules added for assigment #6
const authData = require('./auth-service');
const clientSessions = require('client-sessions');

const app = express();
const upload = multer();

//Cloudinary configuration
cloudinary.config({
    cloud_name: "dqcbey2fr",
    api_key: "465325822784863",
    api_secret: "GHqyVmEiERQYd13Ln1OVtTl_FVk",
    secure: true
});

const HTTP_PORT = process.env.PORT || 8080;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressEjsLayouts);
app.set('layout', 'layouts/main');

// Middleware for parsing form data
app.use(express.urlencoded({ extended: true }));

// Middleware for serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Client Sessions Setup (Assignment 6)
app.use(clientSessions({
    cookieName: "session",
    secret: "web322_assignment6_secret_key",
    duration: 2 * 60 * 1000, // 2 minutes
    activeDuration: 1000 * 60 // 1 minute
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// ensureLogin Middleware (Assignment 6)
function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        next();
    }
}


// Middleware for serving static files
app.use((req, res, next) => {
    let route = req.path.substring(1);
    res.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
    res.locals.viewingCategory = req.query.category;
    next();
});

// Helper function for formatting dates
app.locals.formatDate = function (dateObj) {
    let year = dateObj.getFullYear();
    let month = (dateObj.getMonth() + 1).toString();
    let day = dateObj.getDate().toString();
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Routes

// Home redirects to /shop
app.get('/', (req, res) => {
    res.redirect('/shop');
});

// Static about page
app.get('/about', (req, res) => {
    res.render('about');
});

// Get published items for shop
app.get('/shop', async (req, res) => {
    try {
        let items = req.query.category 
            ? await storeService.getPublishedItemsByCategory(req.query.category)
            : await storeService.getPublishedItems();

        const categories = await storeService.getCategories();

        res.render("shop", { data: { items, categories } });
    } catch (err) {
        res.render("shop", { data: { message: "no results", categories: [] } });
    }
});

// View a specific shop item
app.get('/shop/:id', async (req, res) => {
    try {
        let item = await storeService.getItemById(req.params.id);
        let items = await storeService.getPublishedItems();
        let categories = await storeService.getCategories();

        res.render("shop", { data: { item, items, categories } });
    } catch (err) {
        res.render("shop", { data: { message: "no results", categories: [] } });
    }
});

// View all items (with filters) - Protected
app.get('/items', ensureLogin, async (req, res) => {
    try {
        const { category, minDate } = req.query;
        let items;

        if (category) {
            items = await storeService.getItemsByCategory(category);
        } else if (minDate) {
            items = await storeService.getItemsByMinDate(minDate);
        } else {
            items = await storeService.getAllItems();
        }

        if (items && items.length > 0) {
            res.render("items", { items });
        } else {
            res.render("items", { message: "no results" });
        }
    } catch (err) {
        res.render("items", { message: "no results" });
    }
});

// JSON data for one item (used for debugging/API)
app.get('/item/:id', (req, res) => {
    storeService.getItemById(req.params.id)
        .then(item => res.json(item))
        .catch(err => res.status(500).json({ message: err }));
});

// Render all categories - Protected
app.get('/categories', ensureLogin, async (req, res) => {
    try {
        const categories = await storeService.getCategories();
        if (categories && categories.length > 0) {
            res.render("categories", { categories });
        } else {
            res.render("categories", { message: "no results" });
        }
    } catch (err) {
        res.render("categories", { message: "no results" });
    }
});

// Add category form - Protected
app.get('/categories/add', ensureLogin, (req, res) => {
    res.render('addCategory');
});

// Add category (POST) - Protected
app.post('/categories/add', ensureLogin, (req, res) => {
    storeService.addCategory(req.body)
        .then(() => res.redirect('/categories'))
        .catch(() => res.status(500).send("Unable to Add Category"));
});

// Delete category by ID - Protected
app.get('/categories/delete/:id', ensureLogin, (req, res) => {
    storeService.deleteCategoryById(req.params.id)
        .then(() => res.redirect('/categories'))
        .catch(() => res.status(500).send("Unable to Remove Category / Category not found"));
});

// Add item form - Protected
app.get('/items/add', ensureLogin, (req, res) => {
    storeService.getCategories()
        .then((data) => res.render('addItem', { categories: data }))
        .catch(() => res.render('addItem', { categories: [] }));
});

// Add item (POST with image upload) - Protected
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
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream((error, result) => {
                    if (result) resolve(result); else reject(error);
                });
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

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

// Delete item by ID - Protected
app.get('/items/delete/:id', ensureLogin, (req, res) => {
    storeService.deleteItemById(req.params.id)
        .then(() => res.redirect('/items'))
        .catch(() => res.status(500).send("Unable to Remove Item / Item not found"));
});

// New Routes for Assignment 6 - Authentication
app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    authData.registerUser(req.body)
        .then(() => {
            res.render('register', {
                successMessage: "User created"
            });
        })
        .catch((err) => {
            res.render('register', {
                errorMessage: err,
                userName: req.body.userName
            });
        });
});

app.post('/login', (req, res) => {
    req.body.userAgent = req.get('User-Agent');

    authData.checkUser(req.body)
        .then((user) => {
            req.session.user = {
                userName: user.userName,
                email: user.email,
                loginHistory: user.loginHistory
            };
            res.redirect('/items');
        })
        .catch((err) => {
            res.render('login', {
                errorMessage: err,
                userName: req.body.userName
            });
        });
});

app.get('/logout', (req, res) => {
    req.session.reset();
    res.redirect('/');
});

app.get('/userHistory', ensureLogin, (req, res) => {
    res.render('userHistory');
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).render('404');
});

// Initialize services and start server
// Initialize services and export app for Vercel
storeService.initialize()
    .then(authData.initialize)
    .then(() => {
        if (process.env.NODE_ENV !== 'production') {
            app.listen(HTTP_PORT, () => {
                console.log("Express http server listening on port", HTTP_PORT);
            });
        }
    })
    .catch((err) => {
        console.error('Error initializing data:', err);
        process.exit(1);
    });

const serverless = require('serverless-http');
module.exports = app;
module.exports.handler = serverless(app);
