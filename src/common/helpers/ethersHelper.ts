import provider from '../utils/ethers';
import erc20Abi from '../../abis/erc20.json';
import { ethers } from 'ethers';
import { BalancePayload, TransferPayload } from '../utils/types';
import { successResponse } from '../utils';

interface GetContract {
  rpcUrl: string;
  privateKey?: string;
  tokenAddress?: string;
}

export const getContract = async ({
  tokenAddress,
  rpcUrl,
  privateKey,
}: GetContract) => {
  const providerInstance = provider(rpcUrl);
  const gasPrice = await providerInstance.getGasPrice();
  const gas = ethers.BigNumber.from(21000);

  let nonce;
  let contract;
  let signer;

  if (privateKey && tokenAddress) {
    signer = new ethers.Wallet(privateKey, providerInstance);
    nonce = providerInstance.getTransactionCount(signer.getAddress());
    contract = new ethers.Contract(tokenAddress, erc20Abi, signer);
  } else if (privateKey && !tokenAddress) {
    signer = new ethers.Wallet(privateKey, providerInstance);
    nonce = providerInstance.getTransactionCount(signer.getAddress());
  } else if (tokenAddress && !privateKey) {
    contract = new ethers.Contract(tokenAddress, erc20Abi, providerInstance);
  }

  return {
    contract,
    signer,
    gasPrice,
    gas,
    nonce,
    providerInstance,
  };
};

export const getBalance = async ({
  rpcUrl,
  tokenAddress,
  address,
}: BalancePayload) => {
  const { contract, providerInstance } = await getContract({
    rpcUrl,
    tokenAddress,
  });

  try {
    let balance;

    if (contract) {
      const decimals = await contract.decimals();

      balance = await contract.balanceOf(address);

      return successResponse({
        balance: parseFloat(ethers.utils.formatUnits(balance, decimals)),
      });
    }

    balance = await providerInstance.getBalance(address);

    return successResponse({
      balance: parseFloat(ethers.utils.formatEther(balance)),
    });
  } catch (error) {
    throw error;
  }
};

export const createEthereumWallet = async () => {
  const wallet = ethers.Wallet.createRandom();

  return successResponse({
    address: wallet.address,
    privateKey: wallet.privateKey,
  });
};

export const transfer = async ({
  privateKey,
  tokenAddress,
  rpcUrl,
  ...args
}: TransferPayload) => {
  const {
    contract,
    providerInstance,
    gasPrice,
    gas,
    nonce,
  } = await getContract({ rpcUrl, privateKey, tokenAddress });

  let wallet = new ethers.Wallet(privateKey, providerInstance);

  try {
    let tx;

    if (contract) {
      const decimals = await contract.decimals();

      tx = await contract.transfer(
        args.recipientAddress,
        ethers.utils.parseUnits(args.amount.toString(), decimals),
        {
          gasPrice:
            ethers.utils.parseUnits(args.gasPrice as string, 'gwei') ||
            gasPrice,
          nonce: args.nonce || nonce,
        }
      );
    } else {
      tx = await wallet.sendTransaction({
        to: args.recipientAddress,
        value: ethers.utils.parseEther(args.amount.toString()),
        gasPrice:
          ethers.utils.parseUnits(args.gasPrice as string, 'gwei') || gasPrice,
        gasLimit: gas,
        nonce: args.nonce || nonce,
      });
    }

    return successResponse({
      hash: tx.hash,
    });
  } catch (error) {
    throw error;
  }
};
