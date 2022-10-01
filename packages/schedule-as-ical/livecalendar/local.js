console.log(process.env.SHARE_URL)
require('./ical-function.js').main({excludeNKL: true}).then((res) => res)
