const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
const roots=['src/app/dashboard/education','src/app/portal/education','src/app/api/education','src/products/bella-education'];
const result=roots.flatMap(walk).filter(f=>/\.[jt]sx?$/.test(f)&&!f.includes('__tests__')).map(file=>{
  const content=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true);
  const imports=[],calls=[],constants=[];
  const line=n=>ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1;
  function visit(n){
    if(ts.isImportDeclaration(n))imports.push({line:line(n),module:n.moduleSpecifier.text});
    if(ts.isCallExpression(n)){const name=n.expression.getText(ast);if(/(^fetch$|\.from$|\.rpc$|assert|authorize|calculate|complete|approve|seed|Contract|new )/i.test(name))calls.push({line:line(n),call:name,arguments:n.arguments.map(a=>a.getText(ast).slice(0,180))});}
    if(ts.isVariableDeclaration(n)&&/DEFAULT|DEMO|MOCK|POLICY|THRESHOLD|RULE|FIXTURE/.test(n.name.getText(ast)))constants.push({line:line(n),name:n.name.getText(ast),value:n.initializer?.getText(ast).slice(0,140)});
    ts.forEachChild(n,visit);
  }visit(ast);
  return {file:file.replaceAll('\\','/'),lines:content.split('\n').length,imports,calls,constants};
});
fs.writeFileSync(path.join(__dirname,'inventory.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({files:result.length,pages:result.filter(r=>r.file.endsWith('/page.tsx')).map(r=>({file:r.file,lines:r.lines,imports:r.imports.filter(i=>/platform|products|supabase|services/.test(i.module)),dataCalls:r.calls.filter(c=>/fetch|\.from$|\.rpc$/.test(c.call)),constants:r.constants}))},null,2));
