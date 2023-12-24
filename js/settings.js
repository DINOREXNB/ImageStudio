var num=document.getElementById('num');
var size0=document.getElementById('sizeSmall');
var size1=document.getElementById('sizeMedium');
var size2=document.getElementById('sizeLarge');
var autosave=document.getElementById('autoSave');
const back=document.getElementById('back');
const savesettings=document.getElementById('savesettings');
back.addEventListener('click',()=>{
    window.location.href='/hall';
});
num.addEventListener('input',()=>{
    document.getElementById('numofimg').innerHTML=`Num <i class="fa fa-image">&nbsp;&nbsp;<b>${parseInt(num.value)}</b></i>`;
})
savesettings.addEventListener('click',()=>{
    var size=0;
    var autosave_temp=0;
    if(size0.checked){
        size=0;
    }else if(size1.checked){
        size=1;
    }else{
        size=2;
    }
    if(autosave.checked){
        autosave_temp=1;
    }else{
        autosave_temp=0;
    }
    const data={
        "num":parseInt(num.value),
        "size":size,
        "autosave":autosave_temp
    }
    fetch('save-settings',{
        method:'POST',
        body:JSON.stringify(data)
    }).then((response)=>{
        response.json();
        alert('Saved successfully');
    }).catch((error)=>{
        console.error("Error",error);
    });
})

async function getPreference(){
    try{
        const response=await fetch('/getPreference',{
            method:'POST',
            headers:{
                'Content-Type': 'application/json'
            }
        });
        const data=await response.json();
        console.log(data);
        num.value=data.num;
        document.getElementById('numofimg').innerHTML=`Num <i class="fa fa-image">&nbsp;&nbsp;<b>${parseInt(num.value)}</b></i>`;
        size0.checked=false;
        size1.checked=false;
        size2.checked=false;
        switch(data.size){
            case 0: {size0.checked=true;break;}
            case 1: {size1.checked=true;break;}
            case 2: {size2.checked=true;break;}
        }
        switch(data.autosave){
            case 0:{autosave.checked=false;break;}
            case 1:{autosave.checked=true;break;}
        }
    }catch(error){
        console.log(error);
        return null;
    }
}

window.onload=async ()=>{
    await getPreference();
}