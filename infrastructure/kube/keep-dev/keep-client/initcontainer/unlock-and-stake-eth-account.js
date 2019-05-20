
/*
We override transactionConfirmationBlocks and transactionBlockTimeout because they're
25 and 50 blocks respectively at default.  The result of this on small private testnets
is long wait times for scripts to execute.
*/
const web3_options = {
    defaultBlock: 'latest',
    defaultGas: 4712388,
    transactionBlockTimeout: 25,
    transactionConfirmationBlocks: 3,
    transactionPollingTimeout: 480
}
const Web3 = require('web3');
// ENV VARs sourced from InitContainer Dockerfile
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_HOSTNAME + ":" + process.env.ETH_HOST_PORT), null, web3_options);
const fs = require('fs');

/*
Each <contract.json> file is sourced directly from the InitContainer.  Files are generated by
Truffle during contract and copied to the InitContainer image via Circle.
*/
const stakingProxyContractJsonFile = "/tmp/StakingProxy.json";
const stakingProxyContractParsed = JSON.parse(fs.readFileSync(stakingProxyContractJsonFile));
const stakingProxyContractAbi = stakingProxyContractParsed.abi;
// ENV VAR sourced from InitContainer Dockerfile
const stakingProxyContractAddress = stakingProxyContractParsed.networks[process.env.ETH_NETWORK_ID].address;
const stakingProxyContract = new web3.eth.Contract(stakingProxyContractAbi, stakingProxyContractAddress);

// tokenStaking
const tokenStakingContractJsonFile = "/tmp/TokenStaking.json";
const tokenStakingContractParsed = JSON.parse(fs.readFileSync(tokenStakingContractJsonFile));
const tokenStakingContractAbi = tokenStakingContractParsed.abi;
const tokenStakingContractAddress = tokenStakingContractParsed.networks[process.env.ETH_NETWORK_ID].address;
const tokenStakingContract = new web3.eth.Contract(tokenStakingContractAbi, tokenStakingContractAddress);

// keepToken
const keepTokenContractJsonFile = "/tmp/KeepToken.json";
const keepTokenContractParsed = JSON.parse(fs.readFileSync(keepTokenContractJsonFile));
const keepTokenContractAbi = keepTokenContractParsed.abi;
const keepTokenContractAddress = keepTokenContractParsed.networks[process.env.ETH_NETWORK_ID].address;
const keepTokenContract = new web3.eth.Contract(keepTokenContractAbi, keepTokenContractAddress);

// Eth account used by keep-client.  ENV VAR sourced from keep-client Kube deployment config.
const operator = process.env.KEEP_CLIENT_ETH_ACCOUNT_ADDRESS;

// Eth account that contracts are migrated against. ENV VAR sourced from Docker image.
const contract_owner = process.env.CONTRACT_OWNER_ETH_ACCOUNT_ADDRESS;

// Stake a target eth account
async function stakeEthAccount() {

  // ENV VAR sourced from Docker image.
  let magpie = process.env.CONTRACT_OWNER_ETH_ACCOUNT_ADDRESS;

  let signature = Buffer.from((await web3.eth.sign(web3.utils.soliditySha3(contract_owner), operator)).substr(2), 'hex');
  let delegation = '0x' + Buffer.concat([Buffer.from(magpie.substr(2), 'hex'), signature]).toString('hex');

  try{
    console.log("Running stakingProxyContract.isAuthorized:")
    if (!await stakingProxyContract.methods.isAuthorized(tokenStakingContract.address).call({from: contract_owner}).then((receipt) => {
        console.log("stakingProxyContract.isAuthorized transaction receipt:")
        console.log(receipt)
        console.log("----------------------------------------")
    })) {
      console.log("Running stakingProxyContract.authorizeContract:")
      await stakingProxyContract.methods.authorizeContract(tokenStakingContract.address).send({from: contract_owner}).then((receipt) => {
        console.log("stakingProxyContract.authorizeContract transaction receipt:")
        console.log(receipt)
      })
    }
    console.log("stakingProxy/tokenStaking contracts authorized!")
    console.log("----------------------------------------")
  }
  catch(error) {
    console.error(error);
  }

  try {
    await keepTokenContract.methods.approveAndCall(
      tokenStakingContract.address,
      formatAmount(1000000, 18),
      delegation).send({from: contract_owner}).then((receipt) => {
        console.log("approveAndCall receipt:")
        console.log(receipt);
        console.log("Account " + operator + " staked!");
      });
  }
  catch(error) {
    console.error(error);
  }
};

async function unlockEthAccount(callback) {

  // ENV VARs sourced from keep-client Kube deployment config.
  let operator_eth_account_password = process.env.KEEP_CLIENT_ETH_ACCOUNT_PASSWORD;
  let contract_owner_eth_account_password = process.env.KEEP_CLIENT_ETH_ACCOUNT_PASSWORD;

  try {
    console.log("Unlocking operator account: " + operator);
    await web3.eth.personal.unlockAccount(operator, operator_eth_account_password, 150000);
    console.log("Operator account " + operator + " unlocked!");

    console.log("Unlocking contract_owner account: " + contract_owner);
    await web3.eth.personal.unlockAccount(contract_owner, contract_owner_eth_account_password, 150000);
    console.log("Contract_owner account " + contract_owner + " unlocked!");
  }
  catch(error) {
    console.error(error);
  }
  callback();
}

/*
\heimdall aliens numbers.  Really though, the approveAndCall function expects numbers
in a particular format, this function facilitates that.
*/
function formatAmount(amount, decimals) {
  return '0x' + web3.utils.toBN(amount).mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals))).toString('hex')
}

unlockEthAccount(stakeEthAccount);