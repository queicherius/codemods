const {resolve} = require('path')

const DEBUG = false

const ROOT_DIRECTORY = resolve('.') + '/'
const ALIAS_PATH = 'src/'

function filterRelativePaths (path) {
  return path.value.value.startsWith('~')
}

function renameLiteral (jscodeshift, filePath) {
  return function (path) {
    DEBUG && console.log('filePath', filePath)

    // Get the absolute file path, starting at the alias path
    let absoluteFilePath = resolve(filePath).replace(ROOT_DIRECTORY, '').replace(ALIAS_PATH, '')
    DEBUG && console.log('absoluteFilePath', absoluteFilePath)

    // Calculate how many times we have to go back to reach the alias path
    const goBackThisMuch = (absoluteFilePath.match(/\//g) || []).length
    DEBUG && console.log('goBackThisMuch', goBackThisMuch)

    // Change the import path from absolute to relative
    let importPath = path.value.value.replace('~/', '')

    if (absoluteFilePath.startsWith('tests')) {
      importPath = 'src/' + importPath
    }

    for (let i = 0; i !== goBackThisMuch; i++) {
      importPath = '../' + importPath
    }

    DEBUG && console.log(`${path.value.value} -> ${importPath}`)
    DEBUG && console.log()
    jscodeshift(path).replaceWith(() => jscodeshift.literal(importPath))
  }
}

function transformAliasToRelative (file, api, options) {
  const {path: filePath, source} = file
  const {jscodeshift} = api
  let {printOptions = {}} = options

  const root = jscodeshift(source)

  const requireDeclarations = root
    .find(jscodeshift.CallExpression, {callee: {type: 'Identifier', name: 'require'}})
    .find(jscodeshift.Literal)
    .filter(filterRelativePaths)

  const importDeclarations = root
    .find(jscodeshift.ImportDeclaration)
    .find(jscodeshift.Literal)
    .filter(filterRelativePaths)

  const nodesToUpdate = [].concat(
    requireDeclarations.paths(),
    importDeclarations.paths()
  )

  const noop = nodesToUpdate.length <= 0
  if (noop) return null

  nodesToUpdate.forEach(renameLiteral(jscodeshift, filePath))

  return root.toSource(printOptions)
}

module.exports = transformAliasToRelative
