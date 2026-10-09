// SPDX-License-Identifier: GPL-2.0-or-later
// Reusable editor adapter; Redcode support is optional for future document types.
import {EditorState} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine,highlightActiveLineGutter,drawSelection} from '@codemirror/view';
import {history,historyKeymap,defaultKeymap,indentWithTab} from '@codemirror/commands';
import {StreamLanguage,syntaxHighlighting,HighlightStyle,bracketMatching} from '@codemirror/language';
import {searchKeymap,highlightSelectionMatches} from '@codemirror/search';
import {setDiagnostics,lintGutter} from '@codemirror/lint';
import {tags} from '@lezer/highlight';
const redcode=StreamLanguage.define({
 token(stream){
  if(stream.eatSpace())return null;
  if(stream.match(/^;(?:redcode[^\s]*|name|author|assert|strategy|date|version|debug|break|trace)\b/i)){stream.skipToEnd();return 'meta';}
  if(stream.eat(';')){stream.skipToEnd();return 'comment';}
  if(stream.match(/^(?:dat|mov|add|sub|mul|div|mod|jmp|jmz|jmn|djn|spl|cmp|seq|sne|slt|nop|ldp|stp)\b/i))return 'keyword';
  if(stream.match(/^(?:org|end|equ|for|rof|pin)\b/i))return 'definitionKeyword';
  if(stream.match(/^\.(?:ab|ba|a|b|f|x|i)\b/i))return 'typeName';
  if(stream.match(/^\d+/))return 'number';
  if(stream.match(/^[#$@<>*{}]/))return 'operator';
  if(stream.match(/^[a-z_][\w]*/i))return 'variableName';
  stream.next();return null;
 },languageData:{commentTokens:{line:';'}}
});
const colors=HighlightStyle.define([
 {tag:tags.keyword,color:'#65d9ee'},{tag:tags.definitionKeyword,color:'#dab2ff'},
 {tag:tags.typeName,color:'#ffbb79'},{tag:tags.number,color:'#f1c96b'},
 {tag:tags.operator,color:'#f4a1c8'},{tag:tags.comment,color:'#8a9caa'},
 {tag:tags.meta,color:'#96cba7'},{tag:tags.variableName,color:'#dae9f3'}
]);
const theme=EditorView.theme({
 '&':{backgroundColor:'#101d29',color:'#dae9f3',fontSize:'13px'},
 '.cm-scroller':{fontFamily:'Consolas, monospace',overflow:'auto',minHeight:'180px',maxHeight:'360px'},
 '.cm-content':{padding:'8px 0'},'.cm-gutters':{backgroundColor:'#0c1721',color:'#829aab',border:'none'},
 '.cm-activeLine,.cm-activeLineGutter':{backgroundColor:'#ffffff08'},
 '.cm-cursor':{borderLeftColor:'#65d9ee'},'&.cm-focused .cm-selectionBackground, .cm-selectionBackground':{backgroundColor:'#31526a'},
 '.cm-panels':{backgroundColor:'#152735',color:'#dae9f3'}
},{dark:true});
export function createEditor(parent,{value='',label='Source',id,language='redcode',onChange=()=>{}}={}){
 const view=new EditorView({parent,state:EditorState.create({doc:value,extensions:[
  lineNumbers(),history(),drawSelection(),highlightActiveLine(),highlightActiveLineGutter(),bracketMatching(),highlightSelectionMatches(),lintGutter(),
  keymap.of([indentWithTab,...defaultKeymap,...historyKeymap,...searchKeymap]),theme,syntaxHighlighting(colors),
  ...(language==='redcode'?[redcode]:[]),EditorView.contentAttributes.of({'aria-label':label,...(id?{id}:{})}),
  EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString());})
 ]})});
 return {view,focus:()=>view.focus(),destroy:()=>view.destroy(),
  diagnostics(items){view.dispatch(setDiagnostics(view.state,items.map(item=>{const line=view.state.doc.line(Math.max(1,Math.min(item.line,view.state.doc.lines)));return {from:line.from,to:line.to,severity:item.severity,message:item.message};})));},
  jump(line){const target=view.state.doc.line(Math.max(1,Math.min(line,view.state.doc.lines)));view.dispatch({selection:{anchor:target.from,head:target.to},effects:EditorView.scrollIntoView(target.from,{y:'center'})});view.focus();}
 };
}
