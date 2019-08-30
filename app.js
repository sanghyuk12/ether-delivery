const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const config = require('./config/config');
const tokenAbi = require('./config/erc20ABI')
const request = require('request');
const mysql = require('mysql');

// connect mysql
const connection = mysql.createConnection({
    host : 'database-2.cbici0gda9ic.ap-northeast-2.rds.amazonaws.com',
    port : '3306',
    user : 'admin',
    password : '3078930789',
    database : 'dv'
});

connection.connect();
/*
connection.query('select * from dv', function(err, res, fileds) {
    if(err) {
       console.error(err.stack);
       return;
    }
    console.log('연결 잘됨');
    console.log(res);
})*/




// init web3
const Web3 = require('web3');
const web3 = new Web3(config.getConfig().httpEndpoint);

let app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let token_list = []
let address



app.use('/login', function(req, res) {
  var method = req.method;

  if (method == 'GET') {
    res.render('login');
  } else {
    let privateKey = req.param('private_key');
    address = req.param('address');
    let globalConfig = config.getConfig();
    globalConfig.privateKey = privateKey;
    globalConfig.address = address;

    res.redirect('/');
  }
});







//nonce인식안됨
app.use('/login2', function(req, res) {
	const DB_password = config.getConfig().DB_password;
  var method = req.method;

  if (method == 'GET') {
    res.render('login2');
  } else {
//    nonce_Key = req.param('noncekey');


    res.redirect('DBpage');
	//console.log("기사용");
	console.log(DB_password);


	var sql2 = 'update dv set status = 1 where nonce=?';
	//var sql = 'select * from dv where nonce=?';
	var param = DB_password;
			connection.query(sql2,param,function(err,DB_res,fields){
				if(err){
					console.error(err.stack);
					return;
				}else{
				 	console.log(DB_res);
				}
			})


  }
});




app.use('/selectLogin', function(req, res) {
  var method = req.method;
	let globalConfig = config.getConfig();

  if (method == 'GET') {
    res.render('selectLogin');
  }
  else {
	let caseNum = req.param('casenum');
	globalConfig.DB_caseNum = caseNum;
	console.log(caseNum);
	if(caseNum == '0'){
		res.redirect('/login');
		}
	else{
		res.redirect('/login2');
		}
	}
});







app.get('/api/getDB', function(req, res) {
    res.render('DBpage');
})




/*
app.use('/api/getDB', function(req, res) {
  var method = req.method;

  if (method == 'GET') {
    res.render('index');
  } else {
    res.redirect('DBpage');
  }

});

*/
app.get('/', function(req, res) {
  res.render('index');
});

app.get('/DBpage', function(req, res) {
	var method = req.method;
	if (method == 'GET'){
    	res.render('DBpage');
	} else {
		res.redirect('DBpage');
	}
});



app.get("/api/get_info", async function(req, res) {
  const address = config.getConfig().address;
  const result = await web3.eth.getBalance(address);
  const ether = web3.utils.fromWei(result, 'ether');
	res.json( { balance: ether, address: address});
});

/*
app.get('/api/getStatus') async function(req, res) {
  // SQL로 Status 1인 갯루를 가져온다
  //

})
*/





app.post('/api/transfer', async function(req, res) {
  let fromAddress = config.getConfig().address;
  let privateKey = config.getConfig().privateKey;
  let contractAddress = req.param('contract');
  let toAddress = req.param('to_address');
  let amount = req.param('amount');
  let etherToWei = web3.utils.toWei(amount, 'ether');

  let rawTx = {}
  let nonce = web3.eth.getTransactionCount(fromAddress, 'pending');
  if(contractAddress) {
    let tokenContract = new web3.eth.Contract(tokenAbi, contractAddress);
    let inputData = tokenContract.methods.transfer(toAddress, amount).encodeABI();
    rawTx = {
      to: contractAddress,
      value: 0,
      gasPrice: '30000000000',
      gas: '210000',
      data: inputData,
      nonce: nonce
    };
  } else {
    rawTx = {
      from: fromAddress,
      to: toAddress,
      value: etherToWei,
      gasPrice: '30000000000',
      gas: '21000',
      nonce: nonce
    };
  }

  let account = web3.eth.accounts.privateKeyToAccount(privateKey)
  let signedTx = await account.signTransaction(rawTx)

  let data = {}

  let txInfo = await web3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, txHash) => {
    if (err) {
      console.log('========== transaction 발생 중 에러 ===========')
      data.result = 'fail'
      res.json(data)
      return
    }
    console.log('========== transaction 발생 ===========')
  })
  console.log('========== transaction 처리완료 ===========')
  data.result = 'success'
  data.txInfo = txInfo
  res.json(data)
})



app.get('/api/get_history', async function(req, res) {
  var my_address = config.getConfig().address;
  console.log(my_address)
  let options = {
    uri: "http://api-ropsten.etherscan.io/api",
    qs: {
      module: "account",
      action: "txlist",
      address: my_address,
      startblock: 0,
      endblock: 99999999,
      sort: "asc",
      apikey: config.getConfig().etherscan_api_key
    }
  }

  request(options, (error, response, result) => {
    if(error) {
      console.log(error);
    } else {
      res.json(JSON.parse(result))
    }
  })
})


app.get('/api/get_token', async function(req, res) {
  var data = {}
  for(var i = 0; i < token_list.length; i++) {
    console.log(token_list[i])
    var token_Contract = new web3.eth.Contract(tokenAbi, token_list[i]);
    var token_symbol = await token_Contract.methods.symbol().call();
    var token_balance = await token_Contract.methods.balanceOf(address).call();
    data[i] = {
      symbol: token_symbol,
      balance: token_balance
    }
  }
  res.json(data);
})


app.post('/api/add_token', async function(req, res) {
  var contract_Address = req.param('token_contract');
  token_list.push(contract_Address)
})


app.get('/api/add_nonce', async function(req, res) {
	let globalConfig = config.getConfig();

   let complexity = 50;
   let values = "ABCDEFGHIJKLMNOPQRSTUVWZYZabcdefghijklmnopqrstuvwxyz1234567890!@#$%^&*()_+";

   let password = "";
   console.log(" call start")
    //create for loop to choose password characters
   for(var i = 0; i <= complexity; i++){
       password = password + values.charAt(Math.floor(Math.random() * Math.floor(values.length - 1)));
   }
   console.log("callend");
   connection.query('INSERT INTO dv (pub, nonce, status) VALUES (?, ?, ?)', [
       address, password, 0]);

   res.send(password);
	globalConfig.DB_password = password;
//	console.log(DB_password);
})





/*
function load_data()	{
app.get('/api/load_data', async function(req,res){
        connection.query('select * from dv',function(err,DB_res,fields){
                if(err){
                        console.error(err.stack);
                        return;
                }else{
                        for(var i =0; i<res.length; i++){
				console.log("\nPub: " + res[i].pub + " || " + "nonce: " + res[i].nonce + " || " + "status: " + res[i].status);
				//console.log(DB_res);
				//res.send(DB_res);
			}
                }
        })
   })
}
*/

app.get('/api/load_data', async function(req,res){
	let address = config.getConfig().address;
	let caseNum = config.getConfig().DB_caseNum;
	let nonceNum = config.getConfig().DB_password;
	console.log(caseNum);

	if(caseNum == 0){
	        var sql = 'select * from dv where pub=?';
//		var sql2 = 'select count(*) from dv where pub=?';
        	var param = address;

        		connection.query(sql,param ,function(err,DB_res,fields){
                		if(err){
                        		console.error(err.stack);
	                        	return;
        	       		}else{
					//console.log(DB_res);
                        		res.send(DB_res);
                		}
        		})
	}
	else{
		var sql = 'select * from dv where nonce=?';
                var param = nonceNum;
                        connection.query(sql,param ,function(err,DB_res,fields){
                                if(err){
                                        console.error(err.stack);
                                        return;
                                }else{
                                        //console.log(DB_res);
                                        res.send(DB_res);
				}
		})
	}
})




app.get('/api/receive', async function(req,res){
        let address2 = config.getConfig().address;
        let caseNum2 = config.getConfig().DB_caseNum;
        let nonceNum2 = config.getConfig().DB_password;
       

//                var sql = 'select * from dv where pub=?';
                var sql = 'select count(status) from dv where status=1 and pub=?';
                var param = address2;

                        connection.query(sql,param ,async function(err, rows, fields){
                                if(err){
                                        console.error(err.stack);
                                        return;
                                }else{
                             
                                       var count = rows[0]["count(status)"];
                                       console.log(count);
                                       console.log(typeof(count));




    
    let fromAddress = '0x1E56b701f4E089B2E7387b738422c3347d6603D9';
    let privateKey = '0xA9D016DD25FEBAE10DBBE133B960C52814648929EA9EECC0279A7D99DA686AC3';
    let contractAddress = '0x692a70d2e424a56d2c6c27aa97d1a86395877b3a';
    let toAddress = address2;
    let amount = count;
    //let etherToWei = web3.utils.toWei(amount, 'ether');

    let nonce = web3.eth.getTransactionCount(fromAddress, 'pending');

    let tokenContract = new web3.eth.Contract(tokenAbi, contractAddress);
    let inputData = tokenContract.methods.transfer(toAddress, amount).encodeABI();
    let rawTx = {
        to: contractAddress,
        value: 0,
        gasPrice: '30000000000',
        gas: '210000',
        data: inputData,
        nonce: nonce
    };
     let account = web3.eth.accounts.privateKeyToAccount(privateKey)  
	let signedTx= await account.signTransaction(rawTx)

    let data = {}


let txInfo = await web3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, txHash) => {
    if (err) {
      console.log('========== transaction 발생 중 에러 ===========')
      data.result = 'fail'
      res.json(data)
      return
    }
    console.log('========== transaction 발생 ===========')
  })
  console.log('========== transaction 처리완료 ===========')
  data.result = 'success'
  data.txInfo = txInfo
  res.json(data)























                                }
                        })
})








/*
function trana(){
 let fromAddress = 0x1E56b701f4E089B2E7387b738422c3347d6603D9;
  let privateKey = A9D016DD25FEBAE10DBBE133B960C52814648929EA9EECC0279A7D99DA686AC3;
  let contractAddress = 0x692a70d2e424a56d2c6c27aa97d1a86395877b3a;
  let toAddress = req.param(address2);
  let amount = req.param('count');
  let etherToWei = web3.utils.toWei(amount, 'ether');

  let nonce = web3.eth.getTransactionCount(fromAddress, 'pending');

  let tokenContract = new web3.eth.Contract(tokenAbi, contractAddress);
  let inputData = tokenContract.methods.transfer(toAddress, amount).encodeABI();
  let rawTx = {
      to: contractaddress,
      value: 0,
      gasPrice: '30000000000',
      gas: '210000',
      data: inputData,
      nonce: nonce
    };
//  let account = web3.eth.accounts.privateKeyToAccount(privateKey)
//  let signedTx = await account.signTransaction(rawTx)

  let data = {}

  res.json(data)
  let txInfo = await web3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, txHash) => {
  data.result = 'success'
  data.txInfo = txInfo
    if (err) {
  })
  console.log('========== transaction 처리완료 ===========')
      return
    }
    console.log('========== transaction 발생 ===========')
      console.log('========== transaction 발생 중 에러 ===========')
      data.result = 'fail'
      res.json(data)
}

*/










/*
function loaddata(){
	//let DBdata = []
	connection.query('select * from dv',function(err,res,fields){
		if(err){
			console.error(err.stack);
			return;
		}else{
			/*for(var i=0; i<= 99;i++)
				{
					DBdata[i] = res[i];
				}
			console.log(res);
		}
	})

	console.log(DBdata[0]);
	console.log("a");
}
*/


module.exports = app;
