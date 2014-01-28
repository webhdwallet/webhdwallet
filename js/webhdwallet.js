(function($) {

var MAINNET_PUBLIC = 0x0488b21e;
var MAINNET_PRIVATE = 0x0488ade4;
var TESTNET_PUBLIC = 0x043587cf;
var TESTNET_PRIVATE = 0x04358394;

    var key = null;
    var network = null;
    var addresses = null;
    var balance = 0;
    var unspent = {};

    var clearData = function() {
	key = null;
	network = null;
	addresses = {"receive": {},  "change": {}};
	balance = 0;
	pending = 0;
	unspent = {};

	$("#receive_table").find("tr").remove();
	$("#change_table").find("tr").remove();
	$("#balance_display").text('?');
    }

var ops = Bitcoin.Opcode.map;

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
	    console.log(addr);
	    unspent[addr] = data.unspent_outputs;
	    thisbalance = 0
	    for (var x=0; x < unspent[addr].length; x++) {
		console.log(unspent[addr]);
		thisbalance += unspent[addr][x].value;
	    }
	    balance += thisbalance;
	    $("#balance_display").text(balance/100000); // Satoshi to mBTC
	    $("#"+addr).children(".balance").text(thisbalance/100000);
	    console.log($('#'+addr).children(".balance"));
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

    var updateBalances = function() {
	var addresslist = Object.keys(addresses.receive);
	addresslist = addresslist.concat(Object.keys(addresses.change));
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
	    alert("Non-standard key depth: should be 1, and it is "+key.depth+", are you sure you want to continue?");
	}
	echain = key.derive_child(0);
	ichain = key.derive_child(1);

	for (var i =0; i < 5; i++) {
	    var ez = echain.derive_child(i);
	    var eza = ez.eckey.getBitcoinAddress().toString();
	    var row = '<tr id="'+eza+'"><td class="iterator">'+i+'</td><td class="address-field">'+eza+' <span class="open-qroverlay glyphicon glyphicon-qrcode" data-toggle="modal" data-target="#qroverlay" data-addr="'+eza+'"></span></td><td class="balance">?</td><td class="txnum">?</td></tr>';
	    $('#receive_table').append(row);
	    addresses.receive[eza] = ez;
	}
	keys_receive = Object.keys(addresses.receive);
	for (var i =0; i < 5; i++) {
	    var iz = ichain.derive_child(i);
	    var iza = iz.eckey.getBitcoinAddress().toString();
	    var row = '<tr id="'+iza+'"><td class="iterator">'+i+'</td><td class="address-field">'+iza+'</td><td class="balance">?</td><td class="txnum">?</td></tr>';
	    $('#change_table').append(row);
	    addresses["change"][iza] = iz;
	}
	keys_change = Object.keys(addresses.change);

	updateBalances();
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

    });

})(jQuery);
