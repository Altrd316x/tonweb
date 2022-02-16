const TonWeb = require("./index");
const {NftItem} = require("./contract/token/nft/NftItem");
const {NftCollection} = require("./contract/token/nft/NftCollection");
const {NftMarketplace} = require("./contract/token/nft/NftMarketplace");
const {NftSale} = require("./contract/token/nft/NftSale");

async function init() {
    const tonweb = new TonWeb(new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC'));

    const seed = TonWeb.utils.base64ToBytes('vt58J2v6FaSuXFGcyGtqT5elpVxcZ+I1zgu/GUfA5uY=');
    const keyPair = TonWeb.utils.nacl.sign.keyPair.fromSeed(seed);
    const WalletClass = tonweb.wallet.all['v3R1'];
    const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
        wc: 0
    });
    const walletAddress = await wallet.getAddress();
    console.log('wallet address=', walletAddress.toString(true, true, true));

    const nftCollection = new NftCollection(tonweb.provider, {
        ownerAddress: walletAddress,
        royalty: 0.13,
        royaltyAddress: walletAddress,
        baseUri: 'http://localhost:63342/nft-marketplace/',
        uri: 'http://localhost:63342/nft-marketplace/my_collection.json',
        nftItemCodeHex: NftItem.codeHex
    });
    const nftCollectionAddress = await nftCollection.getAddress();
    console.log('collection address=', nftCollectionAddress.toString(true, true, true));

    const deployNftCollection = async () => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({seqno})

        console.log(
            await wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: nftCollectionAddress.toString(true, true, false), // non-bounceable
                amount: TonWeb.utils.toNano(1),
                seqno: seqno,
                payload: null, // body
                sendMode: 3,
                stateInit: (await nftCollection.createStateInit()).stateInit
            }).send()
        );
    }

    const getNftCollectionInfo = async () => {
        const data = await nftCollection.getCollectionData();
        data.ownerAddress = data.ownerAddress.toString(true, true, true);
        console.log(data);
        const royaltyParams = await nftCollection.getRoyaltyParams();
        royaltyParams.royaltyAddress = royaltyParams.royaltyAddress.toString(true, true, true);
        console.log(royaltyParams);
        console.log((await nftCollection.getNftItemAddressByIndex(0)).toString(true, true, true));
        console.log((await nftCollection.getNftItemAddressByIndex(1)).toString(true, true, true));
    }

    const deployNftItem = async () => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({seqno})

        const amount = TonWeb.utils.toNano(0.5);

        console.log(
            await wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: nftCollectionAddress,
                amount: amount,
                seqno: seqno,
                payload: await nftCollection.createMintBody({
                    itemIndex: 1,
                    amount,
                    ownerAddress: walletAddress,
                    uri: 'my_nft.json'
                }),
                sendMode: 3,
            }).send()
        );
    }

    const nftItemAddress = new TonWeb.utils.Address('EQC_44NocaKk3h_8z8gfA58H-V9NbklFntwU6f6Gs54dUqY0');
    console.log('nft item address=', nftItemAddress.toString(true, true, true));
    const nftItem = new NftItem(tonweb.provider, {address: nftItemAddress});

    const getNftItemInfo = async () => {
        const data = await nftCollection.methods.getNftItemContent(nftItem);
        data.collectionAddress = data.collectionAddress.toString(true, true, true);
        data.ownerAddress = data.ownerAddress?.toString(true, true, true);
        console.log(data);
    }

    const marketplace = new NftMarketplace(tonweb.provider, {ownerAddress: walletAddress});
    const marketplaceAddress = await marketplace.getAddress();
    console.log('matketplace address=', marketplaceAddress.toString(true, true, true));


    const deployMarketplace = async () => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({seqno})

        console.log(
            await wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: marketplaceAddress.toString(true, true, false), // non-bounceable
                amount: TonWeb.utils.toNano(1),
                seqno: seqno,
                payload: null, // body
                sendMode: 3,
                stateInit: (await marketplace.createStateInit()).stateInit
            }).send()
        );
    }

    const sale = new NftSale(tonweb.provider, {
        marketplaceAddress: marketplaceAddress,
        nftAddress: nftItemAddress,
        fullPrice: TonWeb.utils.toNano('1.3'),
        marketplaceFee: TonWeb.utils.toNano('0.2'),
        royaltyAddress: nftCollectionAddress,
        royaltyAmount: TonWeb.utils.toNano('0.1'),
    });
    const saleAddress =  await sale.getAddress();
    console.log('sale address', saleAddress.toString(true, true, true));

    const transferNftItem = async () => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({seqno})

        const amount = TonWeb.utils.toNano(0.4);

        console.log(
            await wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: await nftItem.getAddress(),
                amount: amount,
                seqno: seqno,
                payload: await nftItem.createTransferBody({
                    newOwnerAddress: saleAddress,
                    payloadAmount: TonWeb.utils.toNano(0.1),
                    payload: new TextEncoder().encode('gift'),
                    responseAddress: walletAddress
                }),
                sendMode: 3,
            }).send()
        );
    }
    const deploySale = async () => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({seqno})

        const amount = TonWeb.utils.toNano(0.5);

        const body = new TonWeb.boc.Cell();
        body.bits.writeUint(1, 32); // OP deploy new auction
        body.bits.writeCoins(amount);
        body.refs.push((await sale.createStateInit()).stateInit);
        body.refs.push(new TonWeb.boc.Cell());

        console.log(
            await wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: marketplaceAddress,
                amount: amount,
                seqno: seqno,
                payload: body,
                sendMode: 3,
            }).send()
        );
    }

    const cancelSale = async () => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({seqno})

        const amount = TonWeb.utils.toNano(1);

        console.log(
            await wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: saleAddress,
                amount: amount,
                seqno: seqno,
                payload: await sale.createCancelBody({}),
                sendMode: 3,
            }).send()
        );
    }

    const getSaleInfo = async () => {
        const data = await sale.methods.getData();
        data.marketplaceAddress = data.marketplaceAddress.toString(true, true, true);
        data.nftAddress = data.nftAddress.toString(true, true, true);
        data.nftOwnerAddress = data.nftOwnerAddress?.toString(true, true, true);
        data.fullPrice = data.fullPrice.toString();
        data.marketplaceFee = data.marketplaceFee.toString();
        data.royaltyAmount = data.royaltyAmount.toString();
        data.royaltyAddress = data.royaltyAddress.toString(true, true, true);
        console.log(data);
    };


    // await deployNftCollection();
    // await getNftCollectionInfo();
    // await deployNftItem();
    // await getNftItemInfo();
    // await deployMarketplace();
    // await deploySale();
    // await getSaleInfo();
    // await transferNftItem();
    // await cancelSale();
}


init();