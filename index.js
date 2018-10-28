'use strict';
import req from 'superagent';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

class VdiskCrawler {
  constructor(url) {
    this.url = url;
  }

  async start() {
    await this.handleFolderPage(this.url);
  }

  async handleFolderPage(folderPageUrl, parentPath) {
    const res = await this.get(folderPageUrl);
    const data = this.parseJSON(res.text);
    const { name, items } = data;

    const folderPath = parentPath ? path.join(parentPath, name) : name;
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }

    items.forEach(item => {
      if (item['is_dir']) {
        this.handleFolderPage(item['link'], folderPath);
      } else {
        this.downloadFile(path.join(folderPath, item['name']), item['url']);
      }
    });
  }

  downloadFile(filePath, fileUrl) {
    // console.log(filePath, fileUrl);
    if (!fs.existsSync(filePath)) {
      let file = fs.createWriteStream(filePath);
      file.on('finish', function() {
        console.log(`[Done] ${filePath}`);
      });
      file.on('error', function() {
        console.log(`[Error] ${filePath}`);
      });
      req.get(fileUrl).pipe(file);
    } else {
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
