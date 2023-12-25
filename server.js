const express=require("express");
const bodyParser=require('body-parser');
const querystring=require("querystring")
const session=require('express-session');
const http=require("http");
const sqlite=require('sqlite3');
const fs=require("fs");
const yaml = require('js-yaml');
const axios=require('axios');
const path = require('path');
const Jimp = require('jimp');

const imgdir = './images';
const url_genimg="https://api.openai.com/v1/images/generations";
const url_editimg="https://api.openai.com/v1/images/edits";
const url_vision="https://api.openai.com/v1/chat/completions";
const url_prompt_edit="https://api.openai.com/v1/chat/completions";

var account="";
var apikey="";
var preference={
    "num":1,
    "size":2,
    "autosave":1
}
var current_dlgid=0;
var gen_img_only=1;
/********************read Settings.yaml********************/
var settings;
try {
    const yamlContent = fs.readFileSync('settings.yaml', 'utf8');
    settings = yaml.load(yamlContent);
    console.log(settings);
} catch (error) {
    console.error('Error reading or parsing YAML file:', error);
}
var app=express();
const port=settings.port;
const host=settings.host;
/*********************web server**********************/
server=http.createServer((request,response)=>{
    response.writeHead(200,{'Content-Type':'text/plain'});
});
console.log(`Server is running at ${host}`);
var server=app.listen(port,()=>{});
/********************sqlite********************/
const dbPath=__dirname+'/data/user.db';
db=new sqlite.Database(dbPath,(err)=>{
    if(err){
        console.error('Error connecting to the database: ',err.message);
    }else{
        console.log('Connected to database!');
    }
});
/*********************session**********************/
app.use(session({
    secret:'dalle123456',
    cookie:{maxAge:1440*60*1000},
    resave: false,
    saveUninitialized: false
}));
/********************Load static resources***************************/
app.use(express.static('public'));
app.get('/', (req,res)=>{
    console.log("current: index");
    if (req.session.sign) {//检查用户是否已经登录
        console.log(req.session);//打印session的值
        res.redirect(`https://${host}/hall`);
    }else{
        res.sendFile('index.html',{root:'public'});
    }
});
app.get('/hall', (req,res)=>{
    res.sendFile('hall.html',{root:'public'});
    console.log("current: hall");
})
app.get('/settings', (req,res)=>{
    res.sendFile('settings.html',{root:'public'});
    console.log("current: settings");
});
app.get('/css/:filename',(req,res)=>{
    const filename=req.params.filename;
    fs.readFile(`./css/${filename}`,(err,data)=>{
        if(err){
            console.log(`加载${filename}失败！`);
        }
        res.writeHead(200,{
            "Content-type":"text/css"
        });
        res.end(data)
    });
});
app.get('/js/:filename',(req,res)=>{
    const filename=req.params.filename;
    fs.readFile(`./js/${filename}`,(err,data)=>{
        if(err){
            console.log(`加载${filename}失败！`);
        }
        res.writeHead(200,{
            "Content-type":"text/javascript"
        });
        res.end(data);
    });
});
app.get('/images/:folder/:filename',(req,res)=>{
    const folder=req.params.folder;
    const filename=req.params.filename;
    fs.readFile(`./images/${folder}/${filename}`,(err,data)=>{
        if(err){
            console.log(`加载${filename}失败！`);
        }
        res.writeHead(200,{
            "Content-type":"image/png"
        });
        res.end(data);
    });
});
/*********************Process request**********************/
app.post('/login',(req,res)=>{
    let body=[];
    req.on('data',(chunk)=>{
        body.push(chunk);
    });
    req.on('end',()=>{
        req.session.sign = true;
        req.session.name = 'user';
        body = Buffer.concat(body).toString();
        body = querystring.parse(body);
        console.log(body);
        if(body.apikey.substring(0,3)=="sk-"){
            account=body.username;
            apikey=body.apikey;
            //save user info
            db.serialize(()=>{
                db.all("SELECT * FROM user where account = ?",[account],(err,rows)=>{
                    if(err){
                        console.log(err.message);
                    }else{
                        if(rows.length==0){
                            const insertStmt = db.prepare("INSERT INTO user VALUES (?,?)");
                            insertStmt.run(account,apikey);
                            insertStmt.finalize();
                        }else{

                        }
                    } 
                });
            });
            //load preferences in server
            db.serialize(()=>{
                db.all("SELECT * FROM settings where account = ?",[account],(err,rows)=>{
                    if(err){
                        console.log(err.message);
                    }else{
                        if(rows.length==0){
                            //if empty, insert default preferences
                            const insertStmt = db.prepare("INSERT INTO settings VALUES (?, ?, ?, ?)");
                            insertStmt.run(account,1,2,1);
                            insertStmt.finalize();
                        }else{
                            preference=rows[0];
                        }
                    }
                });
            });
            res.redirect(`http://${host}/hall`);
        }else{
            res.redirect(`http://${host}/`);
        }
        body=[];
    });
})
app.post('/getAccount',(req,res)=>{
    if(req.session.sign){
        res.json({
            "account":account
        });
    }else{
        res.json({
            "account":"forbidden"
        });
    }
});
app.post('/save-settings',(req,res)=>{
    var body="";
    req.on('data',(chunk)=>{
        body+=chunk.toString();
    });
    req.on('end',()=>{
        body=JSON.parse(body);
        console.log(body);
        preference=body;
        const deleteStatement = db.prepare('DELETE FROM settings WHERE account = ?');
        const nameToDelete = account;
        deleteStatement.run(nameToDelete);
        deleteStatement.finalize();
        const insertStmt = db.prepare("INSERT INTO settings VALUES (?, ?, ?, ?)");
        insertStmt.run(account, preference.num, preference.size, preference.autosave);
        insertStmt.finalize();
        res.json({"status":200});
    })
});
app.post('/getPreference',(req,res)=>{
    res.json(preference);
});
app.post('/gen-img-only',(req,res)=>{
    var body="";
    req.on('data',(chunk)=>{
        body+=chunk.toString();
    });
    req.on('end',()=>{
        body=JSON.parse(body);
        console.log(body);
        gen_img_only=body.gen_img_only;
        res.json({"status":200});
    });
});
app.post('/gen-img',(req,res)=>{
    var body="";
    var model="dall-e-3";
    var size="1024x1024";
    var rowlength=0;
    var is_edit=0;
    var current_dlgid_temp=current_dlgid;
    var datalength=0;
    var url_list=[];
    req.on('data',(chunk)=>{
        body+=chunk.toString();
    });
    req.on('end',()=>{
        body=JSON.parse(body);
        if(preference.num>1){
            model="dall-e-2";
        }
        switch(preference.size){
            case 0:{size="256x256";model="dall-e-2";break;}
            case 1:{size="512x512";model="dall-e-2";break;}
            case 2:{size="1024x1024";model="dall-e-3";break;}
        }
        if (gen_img_only) {
            readFileAndProcess((data) => {
                data = {
                    "prompt":body.prompt,
                    "model":model,
                    "n":preference.num,
                    "size":size
                };
                sendRequest(data);
            });
        } else {
            readFileAndProcess(sendRequest);
        }
        function readFileAndProcess(callback) {
            fs.readdir(imgdir + `/dlg${current_dlgid_temp}`, (err, files) => {
                if (err) {
                    console.error("Error reading folder", err.message);
                    return;
                }

                if (files.length == 0 || gen_img_only) {
                    console.log("gen...");
                    callback({
                        "prompt": body.prompt,
                        "model": model,
                        "n": preference.num,
                        "size": size
                    });
                } else {
                    console.log("editting...");
                    is_edit=1;
                    callback({
                        "image": fs.createReadStream(imgdir + `/dlg${current_dlgid_temp}/${files.length - 1}.png`),
                        "prompt": body.prompt,
                        "size": size
                    });
                }
            });
        }
        function sendRequest(data){
            var url="";
            var type="";
            console.log(data);
            if(is_edit&&!gen_img_only){
                type="multipart/form-data";
                url=url_editimg;
            }else{
                type="application/json";
                url=url_genimg;
            }
            axios.post(url,data,{
                headers:{
                    'Content-Type': type,
                    'Authorization': `Bearer `+`${apikey}`
                }
            })
            .then((response)=>{
                datalength=response.data.data.length;
                url_list=response.data.data;
                db.serialize(()=>{
                    db.all("SELECT * FROM prompt WHERE account = ? AND id = ?",[account,current_dlgid],(err,rows)=>{
                        if(err){
                            console.log("Error: ",err.message);
                            res.json({"status":500});
                        }else{
                            if(rows.length==0){
                                const insertStmt = db.prepare("INSERT INTO prompt VALUES (?,?,?)");
                                insertStmt.run(current_dlgid,account,response.data.data[0].revised_prompt);
                                insertStmt.finalize();
                            }
                        }
                    });
                    let select_sql=`SELECT * FROM dialogue WHERE id = ${current_dlgid_temp} AND account = '${account}'`
                    db.all(select_sql,(err,rows)=>{
                        if(err){
                            console.log("Error: ",err.message);
                            res.json({"status":500});
                        }else{
                            db.all("SELECT DISTINCT id FROM dialogue where account = ?",[account],(err,idresult)=>{
                                if(err){
                                    console.log("Error: ",err.message);
                                    res.json({"status":500});
                                }else{
                                    if(!fs.existsSync(imgdir+`/dlg${idresult.length}`)){
                                        fs.mkdirSync(imgdir+`/dlg${idresult.length}`);
                                    }
                                    rowlength=rows.length;
                                    console.log(response.data);
                                    const insertStmt = db.prepare("INSERT INTO dialogue VALUES (?,?,?,?,?,?)");
                                    insertStmt.run(current_dlgid_temp,account,`user`,rowlength,body.prompt,"txt");
                                    insertStmt.finalize();
                                    if(response.data.data.length==1&&model=="dall-e-3"){
                                        rowlength++;
                                        const insertStmt = db.prepare("INSERT INTO dialogue VALUES (?,?,?,?,?,?)");
                                        insertStmt.run(current_dlgid_temp, account, `assistant`,rowlength, response.data.data[0].revised_prompt, "txt");
                                        insertStmt.finalize();
                                    }
                                    fs.readdir(imgdir+`/dlg${current_dlgid_temp}`,(err,files)=>{
                                        if(err){
                                            console.error("Error reading folder",err.message);
                                            return;
                                        }
                                        filenum=files.length;
                                        for(var index=0;index<datalength;index++){
                                            var filenum=0;
                                            rowlength++;
                                            const insertStmt = db.prepare("INSERT INTO dialogue VALUES (?,?,?,?,?,?)");
                                            insertStmt.run(current_dlgid_temp,account,`assistant`,rowlength,"","png");
                                            insertStmt.finalize();
                                            if(preference.autosave){
                                                const outputStream = fs.createWriteStream(imgdir+`/dlg${current_dlgid_temp}/${filenum+index}.png`);
                                                axios.get(url_list[index].url,{
                                                    responseType:"stream"
                                                }).then((response)=>{
                                                    const alphaValue = 1
                                                    response.data.pipe(outputStream);
                                                    outputStream.on('finish', () => {
                                                        console.log('Image download complete!');
                                                        if(datalength<=1){
                                                            Jimp.read(imgdir+`/dlg${current_dlgid_temp}/${filenum}.png`)
                                                            .then(image => {
                                                                image.rgba(true);
                                                                image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
                                                                    this.bitmap.data[idx + 3] = Math.floor(255 * alphaValue); 
                                                                });
                                                                return image.write(imgdir+`/dlg${current_dlgid_temp}/${filenum}.png`);
                                                            })
                                                            .then(() => {
                                                                console.log('Conversion complete!');
                                                            })
                                                            .catch(err => {
                                                                console.error(err);
                                                            });
                                                        }
                                                    });
                                                    outputStream.on('error', err => {
                                                        console.error('Error downloading image:', err);
                                                    });
                                                })
                                                .catch((error) => {
                                                    console.error('Error downloading image:', error);
                                                });
                                            }
                                        }
                                    });                         
                                    res.json({
                                        "result":response.data.data
                                    });
                                }
                            })
                        } 
                    });
                });
            })
            .catch((error)=>{
                console.error("Error",error.message);
                res.json({
                    "result":"",
                    "status":error.message
                });
            });
        }
    });
});
app.post('/prompt-edit',(req,res)=>{
    var body="";
    var editted_prompt="";
    req.on('data',(chunk)=>{
        body+=chunk.toString();
    });
    req.on('end',()=>{
        body=JSON.parse(body);
        db.all("SELECT * FROM prompt WHERE account = ? AND id = ?",[account,current_dlgid],(err,rows)=>{
            if(err){
                console.log("Error: ",err.message);
                res.json({"status":500});
            }else{
                if(rows.length==0){
                    const insertStmt = db.prepare("INSERT INTO prompt VALUES (?,?,?)");
                    insertStmt.run(current_dlgid,account,"");
                    insertStmt.finalize(()=>{
                        edit_prompt("");
                    });
                }else{
                    edit_prompt(rows[0].content);
                }
                function edit_prompt(str){
                    const data={
                        "model": "gpt-3.5-turbo",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You're an AI drawing prompt engineer.You are supposed to combining two paragraphs into one paragraph which is logical and cohesive.The statement after the semicolon is much more important!Interjections are not allowed.An objective statement is recommended.Don't reply anything redundant if understand"
                            },
                            {
                                "role": "user",
                                "content": `${str};`+`  ${body.prompt}`
                            }
                        ]
                    }
                    console.log(data.messages);
                    axios.post(url_prompt_edit,data,{
                        headers:{
                            'Content-Type': "application/json",
                            'Authorization': `Bearer `+`${apikey}`
                        }
                    }).then((response)=>{
                        console.log(response.data);
                        console.log(response.data.choices[0]);
                        editted_prompt=response.data.choices[0].message.content
                        axios.post(`http://${host}/gen-img`,JSON.stringify({"prompt":response.data.choices[0].message.content}))
                        .then((response)=>{
                            console.log(response.data);
                            const updateStmt = db.prepare("UPDATE prompt SET content = ? WHERE id = ? AND account = ?");
                            updateStmt.run(editted_prompt, current_dlgid, account, function(err) {
                                if (err) {
                                    return console.error(err.message);
                                }
                                console.log(`prompt editted succuessfully!`);
                            });
                            updateStmt.finalize();
                            res.json({
                                "result":response.data.result
                            })
                        }).catch((error)=>{
                            console.error("Error",error.message," :(");
                            res.json({
                                "result":"",
                                "status":error.message
                            });
                        });
                    }).catch((error)=>{
                        console.error("Error",error.message);
                        res.json({
                            "result":"",
                            "status":error.message
                        });
                    });
                }
            }
        });
    });
});
app.post('/vision',(req,res)=>{
    var body="";
    req.on('data',(chunk)=>{
        body+=chunk.toString();
    })
    req.on('end',()=>{
        body=JSON.parse(body);
        const data={
            "model": "gpt-4-vision-preview",
            "messages": [
              {
                "role": "user",
                "content": [
                  {
                    "type": "text",
                    "text": body.prompt
                  },
                  {
                    "type": "image_url",
                    "image_url": {
                      "url": body.base64
                    }
                  }
                ]
              }
            ],
            "max_tokens": 600
        }
        console.log(data);
        axios.post(url_vision,data,{
            headers:{
                'Content-Type': "application/json",
                'Authorization': `Bearer `+`${apikey}`
            }
        }).then((response)=>{
            console.log(response.data);
            
            db.serialize(()=>{
                db.all("SELECT * FROM dialogue WHERE id = ? and account = ?",[current_dlgid,account],(err,rows)=>{
                    if(err){
                        console.log("Error: ",err.message);
                        res.json({"status":500});
                    }else{
                        db.all("SELECT DISTINCT id FROM dialogue where account = ?",[account],(err,idresult)=>{
                            if(err){
                                console.log("Error: ",err.message);
                                res.json({"status":500});
                            }else{
                                if(!fs.existsSync(imgdir+`/dlg${idresult.length}`)){
                                    fs.mkdirSync(imgdir+`/dlg${idresult.length}`);
                                }
                                console.log(response.data);
                                const insertStmt = db.prepare("INSERT INTO dialogue VALUES (?,?,?,?,?,?)");
                                insertStmt.run(current_dlgid,account,`user`,rows.length,body.prompt,"txt");
                                insertStmt.run(current_dlgid,account,`user`,rows.length+1,"",body.type);
                                insertStmt.run(current_dlgid,account,`assistant`,rows.length+2,response.data.choices[0].message.content,"txt");
                                insertStmt.finalize();
                                var filenum=0;
                                fs.readdir(imgdir+`/dlg${current_dlgid}`,(err,files)=>{
                                    if(err){
                                        console.error("Error reading folder",err.message);
                                        return;
                                    }
                                    filenum=files.length;
                                });
                                const binaryData = Buffer.from(body.base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                                const filePath = imgdir+`/dlg${current_dlgid}/${filenum}.${body.type}`; 
                                fs.writeFileSync(filePath, binaryData);
                                console.log('Image download complete!');
                                // const alphaValue = 1
                                // Jimp.read(imgdir+`/dlg${current_dlgid}/${filenum}.png`)
                                // .then(image => {
                                //     image.rgba(true);
                                //     image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
                                //         this.bitmap.data[idx + 3] = Math.floor(255 * alphaValue); 
                                //     });
                                //     return image.write(imgdir+`/dlg${current_dlgid}/${filenum}.png`);
                                // })
                                // .then(() => {
                                //     console.log('Conversion complete!');
                                // })
                                // .catch(err => {
                                //     console.error(err);
                                // });
                            }
                        });
                    }
                });
            });
            res.json({
                "content":response.data.choices[0].message.content
            })
        }).catch((error)=>{
            console.error("Error",error.message);
            res.json({
                "content":"",
                "status":error.message
            });
        });
    });
});
app.post('/newchat',(req,res)=>{
    db.serialize(()=>{
        db.all("SELECT DISTINCT id FROM dialogue where account = ?",[account],(err,rows)=>{
            if(err){
                console.log(err.message);
                res.json({"status":500});
            }else{
                if(!fs.existsSync(imgdir+`/dlg${rows.length}`)){
                    fs.mkdirSync(imgdir+`/dlg${rows.length}`);
                }
                current_dlgid=rows.length;
                res.json({rows});
            } 
        });
        
    });
});
app.post('/loadDialogue',(req,res)=>{
    let body="";
    req.on('data',(chunk)=>{
        body+=chunk.toString();
    });
    req.on('end',()=>{
        body=JSON.parse(body);
        current_dlgid=body.id;
        db.serialize(()=>{
            db.all(`SELECT * FROM dialogue where account = ? and id= ?`,[account,body.id],(err,rows)=>{
                if(err){
                    console.log(err.message);
                    res.json({"status":500});
                }else{
                    var HTML="";
                    var img_cnt=0;
                    for(let index=0;index<rows.length;index++){
                        switch(rows[index].name){
                            case "assistant":{
                                switch(rows[index].type){
                                    case "txt":{
                                        if(index<rows.length-1){
                                            if(rows[index+1].name=="assistant"&&rows[index+1].type!="txt"){
                                                HTML+=`<div class="dlg"><h2>DALL·E</h2><div class="text">${rows[index].content}</div><div class="image"><img src="/images/dlg${body.id}/${img_cnt}.png" alt=""></div></div>`;
                                                img_cnt++;
                                                index++;
                                            }
                                        }else{
                                            HTML+=`<div class="dlg"><h2>DALL·E</h2><div class="text">${rows[index].content}</div></div>`;
                                        }
                                        break;
                                    }
                                    default:{
                                        HTML+=`<div class="dlg"><h2>DALL·E</h2><div class="image"><img src="/images/dlg${body.id}/${img_cnt}.${rows[index].type}" alt=""></div></div>`;
                                        img_cnt++;
                                        break;
                                    }
                                }
                                break;
                            }
                            case "user":{
                                switch(rows[index].type){
                                    case "txt":{
                                        if(index<rows.length-1){
                                            if(rows[index+1].name=="user"&&rows[index+1].type!="txt"){
                                                HTML+=`<div class="dlg"><h2>${account}</h2><div class="text">${rows[index].content}</div><div class="image"><img src="/images/dlg${body.id}/${img_cnt}.${rows[index+1].type}" alt=""></div></div>`;
                                                img_cnt++;
                                                index++;
                                            }else{
                                                HTML+=`<div class="dlg"><h2>${account}</h2><div class="text">${rows[index].content}</div></div>`;    
                                            }
                                        }else{
                                            HTML+=`<div class="dlg"><h2>${account}</h2><div class="text">${rows[index].content}</div></div>`;
                                        }
                                        break;
                                    }
                                    default:break;
                                }
                                break;
                            }
                            default:break;
                        }
                    }
                    res.json({"HTML":`${HTML}`});
                }
            });
        })
    })
});
app.post('/getNumofDialogue',(req,res)=>{
    db.all("SELECT DISTINCT id FROM dialogue where account = ?",[account],(err,rows)=>{
        if(err){
            console.log(err.message);
            res.json({"status":500});
        }else{
            res.json({rows});
        } 
    });
});

/*
curl https://api.openai.com/v1/images/edits \
  -H "Authorization: Bearer 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" \
  -F image="@0.png" \
  -F prompt="人还不够多！" \
  -F n=1 \
  -F size="1024x1024"
*/
/*
curl https://api.openai.com/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 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" \
  -d '{
    "model": "dall-e-3",
    "prompt": "A cute baby sea otter",
    "n": 1,
    "size": "1024x1024"
  }'


    curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer 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"



  curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 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" \
  -d '{
    "model": "gpt-4-vision-preview",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What’s in this image?"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
            }
          }
        ]
      }
    ],
    "max_tokens": 300
  }'
*/