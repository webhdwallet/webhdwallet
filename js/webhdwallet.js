(function($) {

var MAINNET_PUBLIC = 0x0488b21e;
var MAINNET_PRIVATE = 0x0488ade4;
var TESTNET_PUBLIC = 0x043587cf;
var TESTNET_PRIVATE = 0x04358394;

var RECEIVE_CHAIN = 0;
var CHANGE_CHAIN = 1;

var GAP = 5;  // how many extra addresses to generate

    var key = null;
    var network = null;
    var addresses = {"receive": {},  "change": {}};;
    var balance = 0;
    var pending = 0;
    var unspent = {};
    var lastone = {"receive": GAP, "change": GAP};
    var chains = {"receive": null, "change": null};
    var usechange = 0;

    var clearData = function() {
	key = null;
	network = null;
	addresses = {"receive": {},  "change": {}};
	balance = 0;
	pending = 0;
	unspent = {};
	lastone = {"receive": GAP, "change": GAP};
	chains = {"receive": null, "change": null};
	usechange = 0;

	$("#receive_table").find("tr").remove();
	$("#change_table").find("tr").remove();
	$("#balance_display").text('?');
    }

var ops = Bitcoin.Opcode.map;

//------------
// From https://gist.github.com/paolorossi/5747533
function Queue(handler) {
  var queue = [];

  function run() {
    var callback = function () {
      queue.shift();
      // when the handler says it's finished (i.e. runs the callback)
      // We check for more tasks in the queue and if there are any we run again
      if (queue.length > 0) {
        run();
      }
    }
    // give the first item in the queue & the callback to the handler
    handler(queue[0], callback);
  }

  // push the task to the queue. If the queue was empty before the task was pushed
  // we run the task.
  this.append = function (task) {
    queue.push(task);
    if (queue.length === 1) {
      run();
    }
  }
}
// small handler that launch task and calls the callback
// when its finished
var queue = new Queue(function (task, callback) {
  task(function () {
    // call an option callback from the task
    if (task.callback)
      task.callback();
    // call the buffer callback.
    callback();
  });
});
//------------



var getAddr = function(key) {
    var hash160 = key.eckey.getPubKeyHash();
    var addr = new Bitcoin.Address(hash160);
    addr.version = 0x6f;  // testnet
    return addr.toString();
}

var generate = function() {

    for (var i=0; i<12; i++) {
        c = b.derive_child(i);
	childs.push(c);
        addresses.push(getAddr(c));
        $("#results").append(getAddr(c)+"<br>");
    }

}

var hashFromAddr = function(string) {

    var bytes = Bitcoin.Base58.decode(string);
    var hash = bytes.slice(0, 21);
    var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

    if (checksum[0] != bytes[21] ||
        checksum[1] != bytes[22] ||
        checksum[2] != bytes[23] ||
        checksum[3] != bytes[24]) {
      throw "Checksum validation failed!";
    }

    this.version = hash.shift();
    this.hash = hash;
    return hash;
}

var createOutScript = function(address) {
    var script = new Bitcoin.Script();
    script.writeOp(ops.OP_DUP);
    script.writeOp(ops.OP_HASH160);
    script.writeBytes(hashFromAddr(address));
    script.writeOp(ops.OP_EQUALVERIFY);
    script.writeOp(ops.OP_CHECKSIG);
    return script;
}

var valueFromNumber = function(number) {
    var value = BigInteger.valueOf(number*1e8);
    value = value.toByteArrayUnsigned().reverse();
    while (value.length < 8) value.push(0);
    return value;
}

var valueFromSatoshi = function(number) {
    var value = BigInteger.valueOf(number);
    value = value.toByteArrayUnsigned().reverse();
    while (value.length < 8) value.push(0);
    return value;
}

var createtx = function() {
    var intx = "1197be06096230bf4b8e4de121607dd797c60df60545eda8d90b7f876f24694e";
    in0 = b.derive_child(1)
    var inaddr = getAddr(in0);
    var outaddr0 = "n2hpygZMYkGAB2zbLEaUbBr3EJ5NK9vMHp";
    var outaddr1 = getAddr(b.derive_child(0));
    console.log(inaddr);
    console.log(outaddr0);
    console.log(outaddr1);

    o0s = createOutScript(outaddr0);
    o1s = createOutScript(outaddr1);
    to0 = new Bitcoin.TransactionOut({
        value: valueFromNumber(0.01234567),
        script: o0s
    });
    to1 = new Bitcoin.TransactionOut({
        value: valueFromNumber(0.007),
        script: o1s
    });

    var tx = new Bitcoin.Transaction();

    tx.addOutput(to0);
    tx.addOutput(to1);

    tin = new Bitcoin.TransactionIn({
        outpoint: {
            hash: Bitcoin.Util.bytesToBase64(Bitcoin.Util.hexToBytes(intx).reverse()),
            index: 0
        },
        script: createOutScript(inaddr),
        sequence: 4294967295
    });
    tx.addInput(tin);

    tx.signWithKey(in0.eckey)

    return tx;
}

    var parseScriptString = function(scriptString) {
	var opm = Bitcoin.Opcode.map;
	var inst = scriptString.split(" ");
	var bytescript = [];
	for (thisinst in inst) {
	    var part = inst[thisinst];
	    if ("string" !== typeof part) {
		continue;
	    }
	    if ((part.length > 3) && (part.slice(0, 3) == 'OP_')) {
		for (name in opm) {
		    if (name == part) {
			bytescript.push(opm[name])
		    }
		}
	    } else if (part.length > 0) {
		bytescript.push(Bitcoin.Util.hexToBytes(part));
	    }
	}
	return bytescript;
    };

    var goodUpdate = function(addr) {
    	return function(data, textStatus, jqXHR) {
    	    unspent[addr] = data.unspent_outputs;
    	    thisbalance = 0;
    	    thispending = 0;
    	    for (var x=0; x < unspent[addr].length; x++) {
    		if (confirmations === 0) {
    		    thispending += unspent[addr][x].value;
    		} else {
    		    thisbalance += unspent[addr][x].value;
    		}
    	    }
    	    balance += thisbalance;
    	    $("#balance_display").text(balance/100000000); // Satoshi to BTC
    	    $("#"+addr).children(".balance").text(thisbalance/100000000);
    	};
    }
    var noUpdate = function(addr) {
    	return function(jqXHR, textStatus, errorThrown) {
    	    if (jqXHR.status != 500) {
    		console.log(errorThrown);
    	    } else {
    		$("#"+addr).children(".balance").text(0);
    	    }
    	}
    }
    var reUpdateBalances = function() {
	var addresslist = [];
	for (var k in addresses) {
	    addresslist = addresslist.concat(Object.keys(addresses[k]));
	}
	balance = 0;
	for (var i = 0; i < addresslist.length; i++) {
	    var addr = addresslist[i]

	    var jqxhr = $.get('https://blockchain.info/unspent',
			      {"active": addr,
			       "cors": true,
			       "json": true}
			     )
		.done(goodUpdate(addr))
		.fail(noUpdate(addr))
		.always(function() {});
	}
    }

    var gotUnspent = function(chain, index, addr) {
	return function(data, textStatus, jqXHR) {
	    unspent[addr] = data.unspent_outputs;
	    thisbalance = 0
	    for (var x=0; x < unspent[addr].length; x++) {
		thisbalance += unspent[addr][x].value;
	    }
	    balance += thisbalance;
	    $("#balance_display").text(balance/100000000); // Satoshi to mBTC
	    $("#"+addr).children(".balance").text(thisbalance/100000000);
	};
    }
    var gotUnspentError = function(chain, index, addr) {
	return function(jqXHR, textStatus, errorThrown) {
	    if (jqXHR.status != 500) {
		console.log(errorThrown);
	    } else {
		$("#"+addr).children(".balance").text(0);
	    }
	}
    }

    var checkReceived = function(chain, index, addr, callback) {
    	return function(data, textStatus, jqXHR) {
    	    if (parseInt(data) > 0) {
		var newlast = Math.max(index+GAP+1, lastone[chain]);
		lastone[chain] = newlast;
		queue.append(generateAddress(chain, index+1));

		if (chain === 'change') {
		    usechange = index+1;
		}

		var jqxhr2 = $.get('https://blockchain.info/unspent',
			      {"active": addr,
			       "cors": true,
			       "json": true}
				 )
		    .done(gotUnspent(chain, index, addr))
		    .fail(gotUnspentError(chain, index, addr))
		    .always(function(){});
		callback();
    	    } else {
		$("#balance_display").text(balance/100000000); // Satoshi to mBTC
		$("#"+addr).children(".balance").text(0);
		if (index < lastone[chain]-1) {
		    queue.append(generateAddress(chain, index+1));
		}
		callback();
	    }
    	}
    }

    var updateBalance = function(chain, index, addr, callback) {
    	var jqxhr = $.get('https://blockchain.info/q/getreceivedbyaddress/'+addr, {'cors': true})
    		.done(checkReceived(chain, index, addr, callback));

    }

// Simple task to generate addresses and query them;
var generateAddress = function(chain, index) {
    return function(callback) {
	if (chains[chain]) {
	    var childkey = chains[chain].derive_child(index);
	    var childaddr = childkey.eckey.getBitcoinAddress().toString();

	    var qrcode = ''
	    if (chain === 'receive') {
		qrcode = ' <span class="open-qroverlay glyphicon glyphicon-qrcode" data-toggle="modal" data-target="#qroverlay" data-addr="'+childaddr+'"></span>';
	    }
	    var row = '<tr id="'+childaddr+'"><td class="iterator">'+index+'</td><td class="address-field">'+childaddr+qrcode+'</td><td class="balance">?</td></tr>';
	    $('#'+chain+'_table').append(row);
	    addresses[chain][childaddr] = childkey;

	    if (navigator.onLine) {
		updateBalance (chain, index, childaddr, callback);
	    } else {
		if (index < lastone[chain]-1) {
		    queue.append(generateAddress(chain, index+1));
		}
		callback();
	    }
	} else {
	    callback();
	}
    }
}

    var genTransaction = function() {
	if (balance > 0) {
	    var receiver = $("#receiver_address").val()
	    var amount = Math.ceil(parseFloat($("#receiver_monies").val())*100000000);
	    var fee = Math.ceil(parseFloat($("#fee_monies").val())*100000000);
	    if (!(amount > 0)) {
		console.log("Nothing to do");
	    }
	    if (!(fee >= 0)) {
		fee = 0;
	    }
	    var target = amount + fee;
	    if (target > balance) {
		alert("Not enough money yo!");
		return
	    } else {
		// prepare inputs
		var incoin = [];
		for (var k in unspent) {
		    var u = unspent[k];
		    for (var i = 0; i < u.length; i++) {
			var ui = u[i]
			var coin = {"hash": ui.tx_hash, "age": ui.confirmations, "address": k, "coin": ui};
			incoin.push(coin);
		    }
		}
		var sortcoin = _.sortBy(incoin, function(c) { return c.age; });

		inamount = 0;
		var tx = new Bitcoin.Transaction();

		var toaddr = new Bitcoin.Address(receiver);
		var to = new Bitcoin.TransactionOut({
		    value: valueFromSatoshi(amount),
		    script: Bitcoin.Script.createOutputScript(toaddr)
		});
		tx.addOutput(to);

		var usedkeys = []
		for (var i = 0; i < sortcoin.length; i++) {
		    var coin = sortcoin[i].coin;
		    var tin = new Bitcoin.TransactionIn({
			outpoint: {
			    hash: Bitcoin.Util.bytesToBase64(Bitcoin.Util.hexToBytes(coin.tx_hash)), // no .reverse()!
			    index: coin.tx_output_n
			},
			script: Bitcoin.Util.hexToBytes(coin.script),
			sequence: 4294967295
		    });
		    tx.addInput(tin);
		    inamount += coin.value;
		    usedkeys.push(sortcoin[i].address);

		    if (inamount >= target) {
			break;
		    }
		}

		if (inamount > target) {
		    var changeaddr = chains['change'].derive_child(usechange).eckey.getBitcoinAddress();
		    var ch = new Bitcoin.TransactionOut({
			value: valueFromSatoshi(inamount-target),
			script: Bitcoin.Script.createOutputScript(changeaddr)
		    });
		    tx.addOutput(ch);
		}

		if (key.has_private_key) {
		    for (var i = 0; i < usedkeys.length; i++) {
			k = usedkeys[i];
			var inchain = null;
			if (k in addresses['receive']) {
			    inchain = addresses['receive'];
			} else if (k in addresses['change']) {
			    inchain = addresses['change'];
			}
			if (inchain) {
			    tx.signWithKey(inchain[k].eckey);
			} else {
			    console.log("Don't know about all the keys needed.");
			}
		    }
		    $("#signedtxlabel").show()
		    $("#unsignedtxlabel").hide()
		    $("#submit_signed_transaction").removeAttr('disabled');
		} else {
		    $("#unsignedtxlabel").show()
		    $("#signedtxlabel").hide()
		    $("#submit_signed_transaction").attr('disabled', true);
		}
		$("#output_transaction").val(Bitcoin.Util.bytesToHex(tx.serialize()));

		return tx;

	    }
	}
    }

    var useNewKey = function(source_key) {
	var keylabel = "";
	var networklabel = "";

	clearData();

	try {
	    key = new BIP32(source_key);
	} catch(e) {
	    console.log(source_key);
	    console.log("Incorrect key?");
	}
	if (key) {
	    switch (key.version) {
	    case MAINNET_PUBLIC:
		keylabel = "Public key";
		network = 'prod';
		networklabel = "Bitcoin Mainnet";
		break;
	    case MAINNET_PRIVATE:
		keylabel = "Private key";
		network = 'prod';
		networklabel = "Bitcoin Mainnet";
		break;
	    case TESTNET_PUBLIC:
		keylabel = "Public key";
		network = 'test';
		networklabel = "Bitcoin Testnet";
		break;
	    case TESTNET_PRIVATE:
		keylabel = "Private key";
		network = 'test';
		networklabel = "Bitcoin Testnet";
		break;
	    default:
		key = null;
		console.log("Unknown key version");
	    }
	    Bitcoin.setNetwork(network);
	}
	$("#bip32_key_info_title").text(keylabel);
	$("#network_label").text(networklabel);

	if (key.depth != 1) {
	    alert("Non-standard key depth: should be 1, and it is "+key.depth+", are you sure you want to use that?");
	}

	chains["receive"] = key.derive_child(RECEIVE_CHAIN);
	chains["change"] = key.derive_child(CHANGE_CHAIN);

	queue.append(generateAddress("receive", 0));
	queue.append(generateAddress("change", 0));

    };

    function onInput(id, func) {
        $(id).bind("input keyup keydown keypress change blur", function() {
            if ($(this).val() != jQuery.data(this, "lastvalue")) {
                func();
            }
            jQuery.data(this, "lastvalue", $(this).val());
        });
        $(id).bind("focus", function() {
            jQuery.data(this, "lastvalue", $(this).val());
        });
    };

    var onUpdateSourceKey = function () {
	var source_key = $("#bip32_source_key").val();
	useNewKey(source_key);
    }

    $(document).on("click", ".open-qroverlay", function () {
	var myAddress = $(this).data('addr');
	console.log("-->"+myAddress);
	$("#qraddr").text( myAddress );

	var qrCode = qrcode(5, 'H');
        var text = "bitcoin:"+myAddress;
        text = text.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
        qrCode.addData(text);
        qrCode.make();
        $('#genAddrQR').html(qrCode.createImgTag(4));

    });

    $(document).ready(function() {

        onInput("#bip32_source_key", onUpdateSourceKey);

	$('#generate_transaction').click(genTransaction);
    });

})(jQuery);
