const send=document.getElementById('send');
const toggle_sidebar=document.getElementById('sidebar-toggle');
const settings=document.getElementById('settings');
const usage=document.getElementById('usage');
const query=document.getElementById('query');
const onlygenimg=document.getElementById('gen-img-only');
const interaction=document.getElementById('interaction');
const historychat=document.getElementById('historychat');
const logout=document.getElementById('logout');
const send_image=document.getElementById('send-image');
const fileInput = document.getElementById('imagefile');
const editimage=document.getElementById('edit-image');
const guide=`<h1 style="margin-top: 60px;text-align: center;position: absolute;left: 50%;transform: translate(-50%, -50%);">What can you do?</h1><h2 style="position: relative;top:90px">Draw picture</h2><h4 style="margin-left: 30px;position: relative;margin-top:110px">Input your prompt to command DALL·E</h4><h2 style="position: relative;top:90px">Image vision</h2><h4 style="margin-left: 30px;position: relative;margin-top:110px">Use gpt-4 to understand your image<br>(Conversation records will not be saved)</h4>`
var account="";
var gen_img_only=1;
var cansend=1;
var base64String="";
var type="";
onlygenimg.addEventListener('click',()=>{
    gen_img_only=1;
    if(gen_img_only){
        alert('switch to gen img only🟢');
    }else{
        alert('gen img only cancelled🔴');
    }
    fetch('/gen-img-only',{
        method:'POST',
        body:JSON.stringify({
            "gen_img_only":gen_img_only
        })
    })
});
fileInput.addEventListener('change', (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
        console.log('file info:', selectedFile);
        type=selectedFile.name.slice((selectedFile.name.lastIndexOf(".") - 1 >>> 0) + 2);
        console.log(type);
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function (e) {
              base64String = e.target.result;
            };
            reader.readAsDataURL(selectedFile);
          }
    }
});
send_image.addEventListener('click',()=>{
   fileInput.click();
});
query.addEventListener('input',()=>{
    localStorage.setItem("query",query.value)
})
logout.addEventListener('click',()=>{
    if(confirm('Sure to logout?')){
        window.location.href='/';
    }
});
editimage.addEventListener('click',()=>{
    alert('TODO:(')
});
send.addEventListener('click',()=>{
    var text="";
    if(cansend&&query.value!=""){
        if(interaction.innerHTML==guide){
            document.getElementById('new-chat').click();
            toggle_sidebar.innerHTML = `<i class="fa fa-angle-double-right"></i>`;
            sidebar.style.left =  "-100px";
            interaction.innerHTML='';
        }
        text=query.value;
        localStorage.removeItem("query");
        query.value="";
        // cansend=1-cansend;
        if(base64String==""){
            var url="/gen-img";
            if(interaction.innerHTML!=''&&interaction.innerHTML!=guide){
                url="/prompt-edit";
            }
            interaction.innerHTML+=`<div class="dlg"><h2>${account}</h2><div class="text">${text}</div></div><div class="spinner"></div>`;
            interaction.scrollTop=interaction.scrollHeight;
            fetch(url,{
                method:'POST',
                body:JSON.stringify({
                    "prompt":text,
                })
            })
            .then((response)=>response.json())
            .then((data)=>{
                document.querySelector(".spinner").remove();
                if(data.result==""){
                    interaction.innerHTML+=`<div class="dlg"><h2>DALL·E</h2><div class="text">${data.status}</div></div>`;
                }else{
                    for(var i=0;i<data.result.length;i++){
                        var revised_prompt="";
                        if(data.result[i].revised_prompt!=undefined){
                            revised_prompt=`<div class="text">${data.result[i].revised_prompt}</div>`;
                        }
                        interaction.innerHTML+=`<div class="dlg"><h2>DALL·E</h2>${revised_prompt}<div class="image"><img src="${data.result[i].url}" alt="" id="${data.result[i].url}"></div></div>`;
                        document.getElementById(`${data.result[i].url}`).addEventListener('load',()=>{
                            interaction.scrollTop=interaction.scrollHeight;
                        });
                    }
                }
            });
        }else{
            interaction.innerHTML+=`<div class="dlg"><h2>${account}</h2><div class="text">${text}</div><div class="image"><img src="${base64String}" alt=""></div></div><div class="spinner"></div>`;
            interaction.scrollTop=interaction.scrollHeight;
            fetch('/vision',{
                method:'POST',
                body:JSON.stringify({
                    "prompt":text,
                    "base64":base64String,
                    "type":type
                })
            })
            .then((response)=>response.json())
            .then((data)=>{
                document.querySelector(".spinner").remove();
                if(data.content==""){
                    interaction.innerHTML+=`<div class="dlg"><h2>GPT-4</h2><div class="text">${data.status}</div></div>`;
                }else{
                    interaction.innerHTML+=`<div class="dlg"><h2>GPT-4</h2><div class="text">${data.content}</div></div>`;
                }
                interaction.scrollTop=interaction.scrollHeight;
                base64String="";
            });
        }
    }
});
toggle_sidebar.addEventListener('click',()=>{
    var sidebar = document.getElementById("sidebar");
    toggle_sidebar.innerHTML = (toggle_sidebar.innerHTML==`<i class="fa fa-angle-double-right"></i>`)? `<i class="fa fa-angle-double-left"></i>`:`<i class="fa fa-angle-double-right"></i>`;
    sidebar.style.left = (sidebar.style.left === "-100px" || sidebar.style.left === "") ? "0px" : "-100px";
});
settings.addEventListener('click',()=>{
    window.location.href="/settings";
});
usage.addEventListener('click',()=>{
    window.open("https://platform.openai.com/usage", '_blank');
});

async function getAccount(){
    try{
        const response=await fetch('/getAccount',{
            method:'POST',
            headers:{
                'Content-Type': 'application/json'
            }
        });
        const data=await response.json();
        if(data.account=="forbidden"){
            alert("请重新登录");
            window.location.href="/";
        }else{
            account=data.account;
        }
    }catch(error){
        console.log(error);
        return null;
    }
}

async function load_sidebar(){
    try{
        const response=await fetch('/getNumofDialogue',{
            method:'POST',
            headers:{
                'Content-Type': 'application/json'
            }
        });
        const data=await response.json();
        for(let index=data.rows.length-1;index>=0;index--){
            historychat.innerHTML+=`<button class="btn" id="btn${index}">chat${index}</button>`;
        }
        for(let index=data.rows.length-1;index>=0;index--){
            document.getElementById(`btn${index}`).addEventListener('click',()=>{
                localStorage.setItem("dialogueid",index);
                window.location.reload();
                fetch('/loadDialogue',{
                    method:'POST',
                    body:JSON.stringify({"id":index})
                })
                .then((response=>response.json()))
                .then((data)=>{
                    toggle_sidebar.click();
                    interaction.innerHTML=`${data.HTML}`;
                    interaction.scrollTop=interaction.scrollHeight;
                });
            });
        }
        document.getElementById('new-chat').addEventListener('click',()=>{
            if(interaction.innerHTML!=guide){
                toggle_sidebar.click();
                interaction.innerHTML=guide;
                fetch('/newchat',{
                    method:'POST'
                })
                .then((response=>response.json()))
                .then((data)=>{
                    var a=document.createElement('button');
                    a.className="btn";
                    a.textContent=`chat${data.rows.length}`;
                    localStorage.setItem('dialogueid',data.rows.length);
                    document.getElementById('new-chat').parentNode.insertBefore(a,document.getElementById('new-chat').nextSibling);
                    a.addEventListener('click',()=>{
                        toggle_sidebar.click();
                        fetch('/loadDialogue',{
                            method:'POST',
                            body:JSON.stringify({"id":data.rows.length})
                        })
                        .then((response=>response.json()))
                        .then((data)=>{
                            interaction.innerHTML=`${data.HTML}`;
                            interaction.scrollTop=interaction.scrollHeight;
                            if(interaction.innerHTML==''){
                                interaction.innerHTML=guide;
                            }
                        });
                    });
                })
            }
        });
    }catch(error){
        console.log(error);
        return null;
    }
}

async function loadDialogue(index){
    fetch('/loadDialogue',{
        method:'POST',
        body:JSON.stringify({"id":parseInt(index)})
    })
    .then((response=>response.json()))
    .then((data)=>{
        interaction.innerHTML=`${data.HTML}`;
        interaction.scrollTop=interaction.scrollHeight;
        if(interaction.innerHTML==""){
            interaction.innerHTML=guide;
        }
    });
}

var isFirstKeyPressed=false;
document.addEventListener("keydown", function(event) {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    if (isMac && event.metaKey && event.key === 'Meta') {
        isFirstKeyPressed = true;
    } else if (!isMac && event.ctrlKey && event.key === 'Control') {
        isFirstKeyPressed = true;
    } else if(isFirstKeyPressed && event.key === 'Enter'){
        event.preventDefault();
        send.click();
        isFirstKeyPressed = false;
    } else {
        isFirstKeyPressed = false;
    }
});

window.onload=async ()=>{
    document.getElementById('query').value=localStorage.getItem("query");
    var index=localStorage.getItem("dialogueid");
    await getAccount();
    await load_sidebar();
    if(index==undefined||index==null){
        interaction.innerHTML=guide;
    }else{
        await loadDialogue(index);
    }
}