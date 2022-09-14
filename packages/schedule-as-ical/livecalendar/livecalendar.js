exports.main = async (args) => {
  require('ts-node').register({})
  return { body: "Done." };
};
