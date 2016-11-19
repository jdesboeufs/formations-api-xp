const excel = require('excel-stream')
const request = require('superagent')
const lunr = require('lunr')
const express = require('express')
const cors = require('cors')
const { clone } = require('lodash')

const textIndex = lunr(function () {
  this.field('da_raison_sociale', {boost: 10})
  this.field('da_siren')
  this.field('numero_de_da')
  this.ref('numero_de_da')
})

const sirenIndex = new Map()
const daIndex = new Map()

function loadData() {
  return new Promise((resolve, reject) => {
    request.get('https://www.data.gouv.fr/s/resources/liste-publique-des-organismes-de-formation-l-6351-7-1-du-code-du-travail/20161116-172953/ListeOF_20161116.xlsx')
      .pipe(excel())
      .on('data', row => {
        textIndex.add(row)
        sirenIndex.set(row.da_siren, row)
        daIndex.set(row.numero_de_da, row)
      })
      .on('error', reject).on('end', resolve)
  })
}

function search(terms) {
  return textIndex.search(terms).map(res => {
    const result = clone(daIndex.get(res.ref))
    result._score = res.score
    return result
  })
}

const app = express()
app.use(cors())

app.get('/organizations', (req, res) => {
  if (!req.query.q) return res.sendStatus(400)
  res.send(search(req.query.q))
})

app.get('/organizations/:id', (req, res) => {
  if (daIndex.has(req.params.id)) return res.send(daIndex.get(req.params.id))
  if (sirenIndex.has(req.params.id)) return res.send(sirenIndex.get(req.params.id))
  res.sendStatus(404)
})

loadData().then(() => {
  console.log(`Loaded ${sirenIndex.size} organizations`)
  app.listen(process.env.PORT || 5000)
}).catch(console.error);
