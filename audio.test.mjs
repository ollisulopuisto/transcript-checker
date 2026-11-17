import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./audio.js',import.meta.url),'utf8');
const begin=source.indexOf('function syncTranscriptWithAudio()');
const end=source.indexOf('/**',begin+1);
function sync(cues,time,last=-1){
 const changes=[];
 const state={transcriptData:cues.map(c=>({...c})),activeCueIndex:last};
 const context={appState:state,audioPlayer:{currentTime:time},currentTimeSpan:{},formatDisplayTime:String,document:{activeElement:null},editableTranscriptTextarea:{},updateFocusedSegmentView:i=>changes.push(i)};
 vm.runInNewContext(source.slice(begin,end)+';syncTranscriptWithAudio()',context);
 return [state.activeCueIndex,changes];
}
test('unsorted saved cues retain first-match highlighting',()=>assert.equal(sync([{start:10,end:12},{start:0,end:5}],2)[0],1));
test('overlap winner does not depend on previous active cue',()=>assert.equal(sync([{start:0,end:10},{start:5,end:8}],6,1)[0],0));
test('forward and backward seeks use half-open intervals and clear gaps',()=>{
 const cues=[{start:0,end:2},{start:3,end:5}];
 assert.equal(sync(cues,3,0)[0],1);assert.equal(sync(cues,1,1)[0],0);assert.equal(sync(cues,2,0)[0],-1);
});
