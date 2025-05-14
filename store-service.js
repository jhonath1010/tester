/**
 * Author: Jhonatan Lopez Olguin
 * Project: Store Service Module
 * Description: Provides Sequelize-based data access for items and categories in PostgreSQL.
 * Technologies: Node.js, Sequelize, PostgreSQL
 * Repository: https://github.com/jhonath1010/web322-app
 */

const Sequelize = require('sequelize');

// PostgreSQL connection setup
const sequelize = new Sequelize('neondb', 'neondb_owner', 'npg_d9NjlmwLqx7W', {
  host: 'ep-patient-sound-a5ztmjkd-pooler.us-east-2.aws.neon.tech',
  dialect: 'postgres',
  port: 5432,
  dialectOptions: {
    ssl: { rejectUnauthorized: false }
  },
  query: { raw: true }
});

// Define models
const Item = sequelize.define('Item', {
  body: Sequelize.TEXT,
  title: Sequelize.STRING,
  postDate: Sequelize.DATE,
  featureImage: Sequelize.STRING,
  published: Sequelize.BOOLEAN,
  price: Sequelize.DOUBLE
});

const Category = sequelize.define('Category', {
  category: Sequelize.STRING
});

Item.belongsTo(Category, { foreignKey: 'category' });

/**
 * Sync the Sequelize models with the database.
 */
function initialize() {
  return sequelize.sync();
}

/**
 * Get all items in the database.
 */
function getAllItems() {
  return Item.findAll()
    .then(items => (items.length ? items : Promise.reject("no results returned")));
}

/**
 * Get all published items.
 */
function getPublishedItems() {
  return Item.findAll({ where: { published: true } })
    .then(items => (items.length ? items : Promise.reject("no results returned")));
}

/**
 * Get all categories.
 */
function getCategories() {
  return Category.findAll()
    .then(categories => (categories.length ? categories : Promise.reject("no results returned")));
}

/**
 * Add a new category.
 * @param {Object} categoryData
 */
function addCategory(categoryData) {
  for (let key in categoryData) {
    if (categoryData[key] === "") categoryData[key] = null;
  }

  return Category.create(categoryData);
}

/**
 * Add a new item.
 * @param {Object} itemData
 */
function addItem(itemData) {
  itemData.published = itemData.published ? true : false;
  itemData.postDate = new Date();

  for (let key in itemData) {
    if (itemData[key] === "") itemData[key] = null;
  }

  return Item.create(itemData);
}

/**
 * Get an item by its ID.
 * @param {Number} id
 */
function getItemById(id) {
  return Item.findAll({ where: { id } })
    .then(items => (items.length ? items[0] : Promise.reject("no results returned")));
}

/**
 * Delete a category by ID.
 * @param {Number} id
 */
function deleteCategoryById(id) {
  return Category.destroy({ where: { id } })
    .then(deleted => (deleted === 1 ? Promise.resolve() : Promise.reject("category not found")));
}

/**
 * Delete an item by ID.
 * @param {Number} id
 */
function deleteItemById(id) {
  return Item.destroy({ where: { id } })
    .then(deleted => (deleted === 1 ? Promise.resolve() : Promise.reject("item not found")));
}

/**
 * Get items by category ID.
 * @param {Number} category
 */
function getItemsByCategory(category) {
  return Item.findAll({ where: { category } })
    .then(items => (items.length ? items : Promise.reject("no results returned")));
}

/**
 * Get items posted after a given date.
 * @param {String} minDateStr
 */
function getItemsByMinDate(minDateStr) {
  const { gte } = Sequelize.Op;

  return Item.findAll({
    where: {
      postDate: { [gte]: new Date(minDateStr) }
    }
  }).then(items => (items.length ? items : Promise.reject("no results returned")));
}

// Export module functions
module.exports = {
  initialize,
  getAllItems,
  getPublishedItems,
  getCategories,
  addItem,
  getItemsByCategory,
  getItemsByMinDate,
  getItemById,
  addCategory,
  deleteCategoryById,
  deleteItemById
};
