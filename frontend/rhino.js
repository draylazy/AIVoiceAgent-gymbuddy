export function createRhino(THREE, scene) {
    const materials=[];
    function mat(color,roughness=.65,metalness=0){const m=new THREE.MeshStandardMaterial({color,roughness,metalness});materials.push(m);return m;}
    const skin=mat('#878984'),skinLight=mat('#a0a199'),ivory=mat('#ece8d9'),jacket=mat('#f4f1e6'),black=mat('#252d2b'),eyeWhite=mat('#fffaf0'),brown=mat('#755139'),pink=mat('#bc8f82'),steel=mat('#bbc6c9',.25,.75),wood=mat('#b6844c'),green=mat('#347543'),paleGreen=mat('#c3dc87'),orange=mat('#e99136'),red=mat('#c95738');
    const sphere=new THREE.SphereGeometry(1,28,20);
    function mesh(parent,g,m,pos=[0,0,0]){const o=new THREE.Mesh(g,m);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
    function ell(parent,m,pos,scale){const o=mesh(parent,sphere,m,pos);o.scale.set(...scale);return o;}
    function box(parent,m,pos,size){return mesh(parent,new THREE.BoxGeometry(...size),m,pos);}
    function cylinder(parent,m,pos,r,h){return mesh(parent,new THREE.CylinderGeometry(r,r,h,32),m,pos);}
    const chef=new THREE.Group();scene.add(chef);chef.visible=false;
    ell(chef,jacket,[0,2.08,0],[.84,.88,.47]);
    for(const s of [-1,1]){
     ell(chef,black,[s*.36,.78,0],[.34,.59,.33]);ell(chef,skin,[s*.38,.23,.13],[.33,.22,.4]);
     for(let j=-1;j<=1;j++)ell(chef,ivory,[s*.38+j*.16,.16,.45],[.08,.09,.1]);
     for(let row=0;row<3;row++)ell(chef,black,[s*.24,2.47-row*.27,.454],[.042,.042,.021]);
    }
    for(let row=0;row<4;row++)for(let col=0;col<12;col++){
     const angle=-1.1+(col+.5)*2.2/12;
     const patch=box(chef,(row+col)%2?black:jacket,[Math.sin(angle)*.73,1.58-row*.13,Math.cos(angle)*.44],[.137,.13,.025]);patch.rotation.y=angle;
    }
    const head=new THREE.Group();head.position.set(0,3.13,.03);chef.add(head);
    ell(head,skin,[0,0,0],[.6,.68,.49]);ell(head,skinLight,[0,-.26,.36],[.53,.36,.42]);
    for(const s of [-1,1]){
     const ear=ell(head,skin,[s*.61,.43,-.05],[.18,.32,.12]);ear.rotation.z=-s*.38;
     const inside=ell(head,pink,[s*.63,.44,.055],[.10,.22,.026]);inside.rotation.z=-s*.38;
     ell(head,eyeWhite,[s*.285,.11,.44],[.155,.18,.095]);ell(head,brown,[s*.28,.095,.518],[.092,.115,.03]);ell(head,black,[s*.28,.1,.547],[.045,.07,.02]);ell(head,eyeWhite,[s*.28-.024,.139,.565],[.022,.025,.01]);
     const brow=ell(head,skin,[s*.28,.28,.445],[.19,.08,.095]);brow.rotation.z=s*.12;
     ell(head,black,[s*.3,-.22,.709],[.065,.045,.024]);
    }
    const horn=mesh(head,new THREE.ConeGeometry(.16,.58,36),ivory,[0,.05,.68]);horn.rotation.x=.14;
    ell(head,black,[0,-.43,.739],[.25,.07,.022]);ell(head,eyeWhite,[0,-.408,.758],[.17,.017,.012]);ell(head,pink,[0,-.469,.754],[.105,.015,.012]);
    cylinder(head,jacket,[0,.65,0],.48,.3);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ell(head,jacket,[Math.cos(a)*.29,.94,Math.sin(a)*.25],[.31,.33,.29]);}
    ell(head,jacket,[0,1.02,0],[.35,.29,.33]);
    const arms=[];
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    function bone(parent,m,a,b,r1,r2){return mesh(parent,new THREE.CylinderGeometry(r1,r2,1,24),m);}
    for(const side of [-1,1]){
     const shoulder=V(side*.74,2.57,0);
     ell(chef,jacket,[side*.78,2.48,0],[.3,.37,.32]);
     const upper=bone(chef,skin,null,null,.24,.21),lower=bone(chef,skin,null,null,.21,.16);
     const elbow=ell(chef,skin,[0,0,0],[.22,.22,.22]);
     const hand=new THREE.Group();chef.add(hand);ell(hand,skin,[0,0,0],[.19,.22,.18]);ell(hand,skinLight,[-side*.14,-.03,.08],[.09,.13,.10]);
     arms.push({side,shoulder,upper,lower,elbow,hand,target:V(side*1.05,1.5,.1)});
    }
    const up=V(0,1,0);
    function alignBone(o,a,b){o.position.copy(a).add(b).multiplyScalar(.5);const delta=b.clone().sub(a);o.scale.y=delta.length();o.quaternion.setFromUnitVectors(up,delta.normalize());}
    function poseArm(arm,target){
     const d=target.clone().sub(arm.shoulder),distance=Math.min(d.length(),1.27);d.normalize();
     const end=arm.shoulder.clone().addScaledVector(d,distance),mid=arm.shoulder.clone().addScaledVector(d,distance/2);
     const pole=V(arm.side,-.15,-.3);pole.addScaledVector(d,-pole.dot(d)).normalize();
     mid.addScaledVector(pole,Math.sqrt(Math.max(0,.65*.65-distance*distance/4)));
     alignBone(arm.upper,arm.shoulder,mid);alignBone(arm.lower,mid,end);arm.elbow.position.copy(mid);arm.hand.position.copy(end);
    }
    const pan=new THREE.Group();arms[0].hand.add(pan);pan.position.set(.45,-.08,.02);
    cylinder(pan,black,[0,0,0],.47,.13);cylinder(pan,steel,[0,.055,0],.465,.025);cylinder(pan,black,[0,.075,0],.42,.025);
    box(pan,black,[-.48,0,0],[.54,.08,.1]);
    const food=[];for(let i=0;i<9;i++){const a=i*2.4;food.push(ell(pan,[green,orange,red][i%3],[Math.cos(a)*.27,.12,Math.sin(a)*.26],[.07,.045,.065]));}
    const spoon=new THREE.Group();arms[1].hand.add(spoon);cylinder(spoon,wood,[0,-.22,0],.035,.55);ell(spoon,wood,[0,-.51,0],[.085,.045,.12]);
    const station=new THREE.Group();chef.add(station);
    box(station,wood,[0,1.58,1.08],[1.6,.1,.72]);
    for(const s of [-1,1]){box(station,black,[s*.63,.78,1.08],[.07,1.5,.08]);}
    const vegetables=new THREE.Group();station.add(vegetables);
    const cucumber=cylinder(vegetables,green,[-.13,1.75,1.13],.105,.63);cucumber.rotation.z=Math.PI/2;
    const slices=[];for(let i=0;i<5;i++){const g=new THREE.Group();vegetables.add(g);g.position.set(.24+i*.105,1.73,1.13);const outer=cylinder(g,green,[0,0,0],.105,.055);outer.rotation.z=Math.PI/2;const face=cylinder(g,paleGreen,[.029,0,0],.082,.004);face.rotation.z=Math.PI/2;slices.push(g);}
    const knife=new THREE.Group();arms[1].hand.add(knife);
    box(knife,black,[0,0,0],[.12,.12,.27]);box(knife,steel,[-.015,-.17,.12],[.035,.23,.48]);
    const bulb=new THREE.Group();chef.add(bulb);bulb.position.set(.82,4.25,.1);
    const glow=mat('#ffe381',.3);glow.emissive=new THREE.Color('#ffbd27');glow.emissiveIntensity=1.1;
    ell(bulb,glow,[0,0,0],[.17,.2,.15]);cylinder(bulb,steel,[0,-.23,0],.07,.11);
    for(let i=0;i<7;i++){const a=.1+i*(Math.PI-.2)/6;const r=cylinder(bulb,glow,[Math.cos(a)*.3,Math.sin(a)*.3,0],.01,.08);r.rotation.z=a-Math.PI/2;}
    const confetti=new THREE.Group();chef.add(confetti);
    for(let i=0;i<30;i++){const c=box(confetti,[green,orange,red,ivory][i%4],[0,0,0],[.05,.08,.018]);c.userData={phase:i/30,seed:i*2.399};}
    
    pan.visible = spoon.visible = station.visible = knife.visible = bulb.visible = confetti.visible = false;
    let action='idle',started=0;
    
    return {
        chef,
        head,
        react: function(type, t) {
            action = type === 'reset' ? 'idle' : type;
            started = t;
            pan.visible=spoon.visible=action==='cook';
            station.visible=knife.visible=action==='slice';
            bulb.visible=action==='think';
            confetti.visible=action==='celebrate';
        },
        update: function(t, dt, motion) {
            const e=t-started;
            const duration=action==='cook'||action==='slice'?8:action==='think'?4.5:3.5;
            if(action!=='idle'&&e>duration){ action='idle'; pan.visible=spoon.visible=station.visible=knife.visible=bulb.visible=confetti.visible=false; }
            chef.position.y=Math.sin(t*2)*.018*motion;chef.rotation.y=Math.sin(t*.6)*.025*motion;
            let left=V(-1.02,1.48,.1),right=V(1.02,1.48,.1);
            if(action==='cook'){
             left=V(-.88,1.95+Math.sin(e*2)*.055*motion,.95);
             right=V(-.05+Math.cos(e*3)*.13*motion,2.49,1.03+Math.sin(e*3)*.12*motion);
             food.forEach((f,i)=>f.position.y=.12+Math.max(0,Math.sin(e*4+i))*.055*motion);head.rotation.x=.10;
            }
            if(action==='slice'){
             const beat=(1-Math.cos(e*7))/2*motion;
             left=V(-.39,1.94,1.02);right=V(.21,1.97+beat*.29,1.06);
             slices.forEach((s,i)=>{s.visible=e>(i+1)*.7;s.position.x=.24+i*.105+Math.min(e/8,1)*i*.025;});head.rotation.x=.14;
            }
            if(action==='think'){
             right=V(.52,2.75,.64);head.rotation.set(-.08,.12,-.12);
             bulb.scale.setScalar(THREE.MathUtils.smoothstep(e,.2,.65));bulb.position.y=4.25+Math.sin(e*2)*.025*motion;glow.emissiveIntensity=1.1+Math.sin(e*3)*.2*motion;
            }
            if(action==='celebrate'){
             left=V(-1.0,3.36+Math.sin(e*6)*.1*motion,.05);right=V(1.0,3.36+Math.sin(e*6+.5)*.1*motion,.05);
             chef.position.y=Math.abs(Math.sin(e*5))*.16*motion;head.rotation.z=Math.sin(e*5)*.06*motion;
             confetti.children.forEach(c=>{const p=(e*.45*motion+c.userData.phase)%1,a=c.userData.seed;c.position.set(Math.cos(a)*(1.0+p*.65),4.4-p*3.3,.5+Math.sin(a)*.45);c.rotation.set(p*5,a+p*4,p*8);});
            }
            const blend=1-Math.exp(-dt*15);
            for(const [i,target] of [left,right].entries()){arms[i].target.lerp(target,blend);poseArm(arms[i],arms[i].target);}
        }
    };
}
