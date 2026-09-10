import { Parser, Store, DataFactory } from 'n3'

/**
 * Engine de Ontologia formal para OWL, RDF e Turtle usando N3.js
 */
export class OntologyEngine {
  constructor() {
    this.store = new Store()
    this.classes = new Map() // IRI -> { label, synonyms, subClasses, parentClasses }
    this.properties = new Map() // IRI -> { label, domain, range }
    this.labels = new Map() // text -> IRI
  }

  /**
   * Faz o parsing de um documento RDF/OWL/Turtle
   * Retorna triplas normalizadas e estruturas taxonômicas
   */
  async parse(ontologyText) {
    return new Promise((resolve, reject) => {
      const parser = new Parser()
      const quads = []
      const triples = []

      parser.parse(ontologyText, (error, quad) => {
        if (error) {
          return reject(error)
        }

        if (quad) {
          quads.push(quad)
          const subject = quad.subject.value
          const predicate = quad.predicate.value
          const object = quad.object.value

          triples.push({
            subject: this.cleanIri(subject),
            predicate: this.cleanIri(predicate),
            object: this.cleanIri(object),
            rawSubject: subject,
            rawPredicate: predicate,
            rawObject: object
          })
        } else {
          // Fim do fluxo (quad === null)
          this.store.addQuads(quads)
          this.buildTaxonomy(quads)
          resolve({
            triples,
            stats: {
              totalTriples: quads.length,
              classesCount: this.classes.size,
              propertiesCount: this.properties.size
            }
          })
        }
      })
    })
  }

  /**
   * Constrói taxonomia interna (Classes, Subclasses, Rótulos e Sinônimos)
   */
  buildTaxonomy(quads) {
    for (const quad of quads) {
      const s = quad.subject.value
      const p = quad.predicate.value
      const o = quad.object.value

      const cleanS = this.cleanIri(s)
      const cleanO = this.cleanIri(o)

      // Identifica Classes (owl:Class, rdfs:Class)
      if (p.endsWith('type') && (o.endsWith('Class') || o.endsWith('owl#Class'))) {
        if (!this.classes.has(cleanS)) {
          this.classes.set(cleanS, {
            iri: s,
            cleanName: cleanS,
            labels: [cleanS],
            synonyms: [],
            parentClasses: [],
            subClasses: []
          })
        }
      }

      // Identifica Subclasses (rdfs:subClassOf)
      if (p.endsWith('subClassOf')) {
        this.ensureClass(cleanS, s)
        this.ensureClass(cleanO, o)

        const child = this.classes.get(cleanS)
        const parent = this.classes.get(cleanO)

        if (!child.parentClasses.includes(cleanO)) child.parentClasses.push(cleanO)
        if (!parent.subClasses.includes(cleanS)) parent.subClasses.push(cleanS)
      }

      // Identifica Rótulos e Sinônimos (rdfs:label, skos:altLabel, owl:equivalentClass)
      if (p.endsWith('label') || p.endsWith('altLabel') || p.endsWith('prefLabel')) {
        this.ensureClass(cleanS, s)
        const classObj = this.classes.get(cleanS)
        const labelVal = quad.object.value.trim()

        if (!classObj.labels.includes(labelVal)) {
          classObj.labels.push(labelVal)
        }
        if (!classObj.synonyms.includes(labelVal)) {
          classObj.synonyms.push(labelVal)
        }
        this.labels.set(labelVal.toLowerCase(), cleanS)
      }

      // Identifica Equivalências (owl:equivalentClass)
      if (p.endsWith('equivalentClass')) {
        this.ensureClass(cleanS, s)
        this.ensureClass(cleanO, o)
        this.classes.get(cleanS).synonyms.push(cleanO)
        this.classes.get(cleanO).synonyms.push(cleanS)
      }

      // Identifica Propriedades de Objeto (owl:ObjectProperty)
      if (p.endsWith('type') && (o.endsWith('ObjectProperty') || o.endsWith('DatatypeProperty'))) {
        this.properties.set(cleanS, {
          iri: s,
          cleanName: cleanS,
          type: o.endsWith('ObjectProperty') ? 'ObjectProperty' : 'DatatypeProperty'
        })
      }
    }
  }

  ensureClass(cleanName, fullIri) {
    if (!this.classes.has(cleanName)) {
      this.classes.set(cleanName, {
        iri: fullIri,
        cleanName,
        labels: [cleanName],
        synonyms: [],
        parentClasses: [],
        subClasses: []
      })
    }
  }

  /**
   * Expansão de Consultas (Query Expansion) baseada nas regras ontológicas ativas
   */
  expandQuery(userQuery, activeTriples = []) {
    const tokens = userQuery.toLowerCase().split(/[\s,.;:?!()]+/).filter(Boolean)
    const expansions = new Set()
    const rulesMatched = []

    for (const token of tokens) {
      if (token.length < 3) continue

      // 1. Busca por rótulo ou sinônimo no grafo interno
      for (const [className, cls] of this.classes.entries()) {
        const matchesName = className.toLowerCase().includes(token)
        const matchesLabel = cls.labels.some(l => l.toLowerCase().includes(token))
        const matchesSynonym = cls.synonyms.some(s => s.toLowerCase().includes(token))

        if (matchesName || matchesLabel || matchesSynonym) {
          cls.labels.forEach(l => expansions.add(l))
          cls.synonyms.forEach(s => expansions.add(s))
          cls.parentClasses.forEach(p => expansions.add(p))
          cls.subClasses.forEach(c => expansions.add(c))

          rulesMatched.push({
            concept: className,
            parents: cls.parentClasses,
            children: cls.subClasses,
            synonyms: cls.synonyms
          })
        }
      }

      // 2. Busca também nas triplas persistidas do IndexedDB
      if (activeTriples && activeTriples.length > 0) {
        for (const t of activeTriples) {
          const sMatch = t.subject.toLowerCase().includes(token)
          const oMatch = t.object.toLowerCase().includes(token)

          if (sMatch || oMatch) {
            expansions.add(t.subject)
            expansions.add(t.object)
            rulesMatched.push({
              rule: `${t.subject} ${t.predicate} ${t.object}`
            })
          }
        }
      }
    }

    // Remove termos redundantes
    const expandedTerms = Array.from(expansions).filter(
      term => !userQuery.toLowerCase().includes(term.toLowerCase())
    )

    let expandedQuery = userQuery
    if (expandedTerms.length > 0) {
      expandedQuery = `${userQuery} (${expandedTerms.slice(0, 5).join(' OR ')})`
    }

    return {
      originalQuery: userQuery,
      expandedQuery,
      expandedTerms,
      rulesMatched: rulesMatched.slice(0, 8)
    }
  }

  /**
   * Formata as regras ontológicas extraídas para injeção no prompt de sistema anti-alucinação
   */
  formatOntologicalRules(rulesMatched) {
    if (!rulesMatched || rulesMatched.length === 0) {
      return 'Nenhuma regra formal específica identificada para os termos desta consulta.'
    }

    const lines = rulesMatched.map(r => {
      if (r.rule) {
        return `- Fato Formal: [${r.rule}]`
      }
      const syn = r.synonyms.length > 0 ? ` (Sinônimos: ${r.synonyms.join(', ')})` : ''
      const par = r.parents.length > 0 ? ` [Subclasse de: ${r.parents.join(', ')}]` : ''
      return `- Conceito [${r.concept}]${syn}${par}`
    })

    return lines.join('\n')
  }

  /**
   * Limpa IRIs completas (ex: "http://www.w3.org/2002/07/owl#Thing" -> "Thing")
   */
  cleanIri(iri) {
    if (!iri) return ''
    if (iri.includes('#')) {
      return iri.split('#').pop()
    }
    if (iri.includes('/')) {
      return iri.split('/').pop()
    }
    return iri
  }
}

export const ontologyEngine = new OntologyEngine()
