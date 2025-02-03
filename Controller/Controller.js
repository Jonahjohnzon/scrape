const puppeteer = require('puppeteer-extra') 
const {Movie} = require('../Schema/Schema')
require('dotenv').config()

const PushMovie = async(req, res) =>{
    let browser;

    try{
    const type = req.params.type
    const tmdb_id  = req.params.id 
    const season = req.query.season
    const episode = req.query.episode
    const server = req.query.server

    let existingData;
    if(type == "movie")
    {
    existingData = await Movie.findOne({ tmdb_id, type , server});
    }
    else{
    existingData = await Movie.findOne({ tmdb_id, type, season, episode , server});
    }

    if (existingData) {
      return res.json({ status: 200, exist:true });
    }
    const tmdbUrl =
    type === "movie"
      ? `https://api.themoviedb.org/3/movie/${tmdb_id}`
      : `https://api.themoviedb.org/3/tv/${tmdb_id}`;
  const tmdbResponse = await fetch(tmdbUrl, {
    headers: {
      Authorization: `${process.env.DB_BEARER}`,
      "Content-Type": "application/json",
    },
  });

  const tmdbData = await tmdbResponse.json();
  const title = tmdbData.title || tmdbData.name || "Unknown Title";

  let pageUrl = "";
  if (type === "movie") {
    pageUrl = `https://vidsrc.rip/embed/${type}/${tmdb_id}`;
  } else {
    if (!season || !episode) {
      return res.status(404).json(
        { error: "Missing required query parameters (season, episode)" }
      );
    }
    pageUrl = `https://vidsrc.rip/embed/${type}/${tmdb_id}/${season}/${episode}`;
  }

  // Puppeteer setup
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.screenshot({
    path: 'hn.png',
  });
  

  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  const m3u8Url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(null); 
    }, 30000); 
    page.on("response", async (response) => {
      try {
        const requestUrl = response.url();
        console.log(requestUrl)
        if (requestUrl.includes(".m3u8")) {
          clearTimeout(timeout); 
          const headers = response.request().headers(); 
          resolve({ requestUrl, headers });
        }
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  
    page.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  
  if (!m3u8Url) {
    return res.status(404).json(
      { success: false, error: "M3U8 URL not found", title },
    );
  }

  
  if (m3u8Url) {
    const { requestUrl, headers } = m3u8Url;

    const newData =  await Movie.create({
      tmdb_id,
      type,
      season,
      episode,
      title,
      requestUrl,
      headers,
      server:'1'
    });

    await newData.save();

    return res.status(200).json(
      { requestUrl, headers, title, success: true },
    );
  }

    }
    catch(err)
    {
        console.log(err)
    } finally {
        if (browser) {
          await browser.close();
        }
      }
}

module.exports = {PushMovie}