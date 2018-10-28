'use strict';
import req from 'superagent';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
const md5File = require('md5-file');

class VdiskCrawler {
  constructor(url) {
    this.url = url;
    this.isVerify = false;
  }

  async start() {
    await this.handleFolderPage(this.url);
    // console.log('Finish download');
    // this.isVerify = true;
    // await this.handleFolderPage(this.url);
  }

  async handleFolderPage(folderPageUrl, parentPath) {
    const res = await this.get(folderPageUrl);
    const data = this.parseJSON(res.text);
    const { name, items } = data;

    const folderPath = parentPath ? path.join(parentPath, name) : name;
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }

    items.forEach(async item => {
      if (item['is_dir']) {
        this.handleFolderPage(item['link'], folderPath);
      } else {
        const filePath = path.join(folderPath, item['name']);
        const fileUrl = item['url'];
        const md5 = item['md5'];
        if (this.isVerify) {
          this.verifyFile(filePath, fileUrl, md5);
        } else {
          await this.downloadFile(filePath, fileUrl, md5);
        }
      }
    });
  }

  verifyFile(filePath, fileUrl, md5) {
    if (!fs.existsSync(filePath)) {
      console.log(`[Need redownload] ${filePath} does not exist. `);
    } else {
      md5File(filePath, (err, hash) => {
        if (hash === md5) {
          console.log(`[Verified] ${filePath}`);
        } else {
          console.log(
            `[Need redownload] ${filePath} exists but incomplete. Delete it now. `
          );
          fs.unlink(filePath, function(err) {
            console.error(err);
          });
        }
      });
    }
  }

  async downloadFile(filePath, fileUrl, md5) {
    // console.log(filePath, fileUrl);
    const that = this;
    if (!fs.existsSync(filePath)) {
      let file = fs.createWriteStream(filePath);
      file.on('finish', function() {
        console.log(`[Done] ${filePath}`);
      });
      file.on('error', function(err) {
        console.log(`[Error] ${filePath}`);
        console.error(err);
      });
      await req.get(fileUrl).pipe(file);
    } else {
      md5File(filePath, (err, hash) => {
        if (hash === md5) {
          //console.log(`[Skip] ${filePath} exists already. `);
        } else {
          console.log(
            `[Redownload] ${filePath} exists but incomplete. Redownload it now. Expected: ${md5}, Actual:${hash}`
          );
          fs.unlink(filePath, function(err) {
            if (!err) {
              that.downloadFile(filePath, fileUrl, md5);
            } else {
              console.error(err);
            }
          });
        }
      });
      return;
    }
  }

  decodeUnicode(str) {
    str = str.replace(/\\/g, '%');
    return unescape(str);
  }

  parseJSON(html) {
    // console.log(html);
    const scriptContent = html.match(/folderDetail\.init\(.*/gim)[0];
    const nameStart = scriptContent.indexOf(`"name":"`);
    const nameEnd = scriptContent.indexOf(`","revision":`);
    const folderName = this.decodeUnicode(
      scriptContent.substring(nameStart + 8, nameEnd)
    );

    const itemsContent = scriptContent
      .match(/"contents":.*,"contents_total"/gim)[0]
      .replace('"contents":', '')
      .replace(',"contents_total"', '');
    // console.log(itemsContent);
    return { name: folderName, items: JSON.parse(itemsContent) };
    // let $ = cheerio.load(html);
    // const content = $('script[type="text/javascript"]');
    // const script = content[2];
    // console.log(content.html());
  }

  get(url) {
    return req.get(url).then(
      res => {
        return res;
      },
      err => {
        console.error(err);
      }
    );
  }
}

const url = 'http://vdisk.weibo.com/s/aUvHc7JaRrcEt';
const crawler = new VdiskCrawler(url);
crawler.start();
