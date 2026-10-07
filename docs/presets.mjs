// Documented historical hill parameters; applying a preset does not submit to a hill.
export const presets = [
 {id:'standard',name:"pMARS standard ’94",values:{}},
 {id:'94nop',name:"KotH ’94 no P-space",values:{noPspace:true,rounds:100},source:'94nop'},
 {id:'88',name:"KotH ’88",values:{rules88:true,rounds:100},source:'88'},
 {id:'nano',name:'SAL Nano',values:{coreSize:80,tasks:80,cycles:800,maxLength:5,distance:5,pspace:5,rounds:100},source:'nano'},
 {id:'tiny',name:'SAL Tiny',values:{coreSize:800,tasks:800,cycles:8000,maxLength:20,distance:20,pspace:50,rounds:100},source:'tiny'},
 {id:'tinylp',name:'SAL Tiny LP',values:{coreSize:800,tasks:8,cycles:8000,maxLength:50,distance:50,pspace:50,rounds:100},source:'tinylp'},
 {id:'94x',name:'KotH Experimental / Big',values:{coreSize:55440,tasks:10000,cycles:500000,maxLength:200,distance:200,pspace:3465,rounds:100},source:'94x'}
];
