console.log(process.env.SHARE_URL)
require('./ical-function.js').main({excludeNKL: true}).then((res) => console.log('body', res.body))
