module.exports = {
  entry: {
    offerer: './src/offerer.js',
    receiver: './src/receiver.js',
  },
  output: {
    filename: '[name].js',
    path: __dirname + '/lib'
  }
};
