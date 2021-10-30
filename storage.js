const fs = require('fs/promises');

class Storage {
  constructor(name) {
    this.filename = `.${name}.json`;
  }

  async get() {
    try {
      const json = await fs.readFile(this.filename, { encoding: 'utf8' });
      return JSON.parse(json);
    } catch (e) {
      if (e.code === 'ENOENT') {
        await fs.writeFile(this.filename, '', {encoding: 'utf8'});
      } else {
        console.error();
      }
      return {};
    }
  }

  async set(data) {
    const json = JSON.stringify(data);
    return await fs.writeFile(this.filename, json, {encoding: 'utf8'})
  }
}

module.exports = Storage;