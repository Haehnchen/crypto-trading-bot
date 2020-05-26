module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.dropAllTables();
  }
};
