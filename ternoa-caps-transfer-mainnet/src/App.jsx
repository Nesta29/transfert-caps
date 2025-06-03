import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { web3Enable, web3Accounts, web3FromAddress } from "@polkadot/extension-dapp";

export default function App() {
  const [wallets, setWallets] = useState([]);
  const [mnemonic, setMnemonic] = useState("");
  const [connected, setConnected] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [simulationResults, setSimulationResults] = useState([]);
  const [api, setApi] = useState(null);
  const [sender, setSender] = useState(null);
  const [useExtension, setUseExtension] = useState(false);

  useEffect(() => {
    const initApi = async () => {
      const provider = new WsProvider("wss://mainnet.ternoa.network");
      const api = await ApiPromise.create({ provider });
      setApi(api);
    };
    initApi();
  }, []);

  const connectMnemonic = () => {
    const keyring = new Keyring({ type: "sr25519" });
    const sender = keyring.addFromUri(mnemonic);
    setSender(sender);
    setConnected(true);
  };

  const connectExtension = async () => {
    const extensions = await web3Enable("Ternoa CAPS Transfer");
    if (extensions.length === 0) return alert("Extension non détectée.");
    const accounts = await web3Accounts();
    if (accounts.length === 0) return alert("Aucun compte trouvé.");
    const injected = await web3FromAddress(accounts[0].address);
    const sender = {
      address: accounts[0].address,
      sign: async (tx) => tx.signAsync(accounts[0].address, { signer: injected.signer }),
      signAndSend: async (tx) => tx.signAndSend(accounts[0].address, { signer: injected.signer }),
    };
    setSender(sender);
    setUseExtension(true);
    setConnected(true);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setWallets(results.data);
      },
    });
  };

  const simulateTransfers = () => {
    const simulated = wallets.map((wallet) => ({
      ...wallet,
      fee: 0.001,
    }));
    setSimulationResults(simulated);
    setSimulated(true);
  };

  const confirmAndSend = async () => {
    if (!window.confirm("Confirmez-vous l'envoi des CAPS ?")) return;
    for (let wallet of wallets) {
      const tx = api.tx.balances.transfer(wallet.address, BigInt(wallet.amount * 1e6));
      useExtension
        ? await sender.signAndSend(tx)
        : await tx.signAndSend(sender);
    }
    alert("Transferts effectués.");
  };

  const disconnect = () => {
    setConnected(false);
    setMnemonic("");
    setSender(null);
    setUseExtension(false);
  };

  return (
    <div>
      <h1>Transfert de CAPS - Ternoa (Mainnet)</h1>

      {connected ? (
        <>
          <p>Connecté avec {useExtension ? "extension" : "mnémotechnique"} — {useExtension ? sender.address : sender.address}</p>
          <button onClick={disconnect}>Se déconnecter</button>
        </>
      ) : (
        <>
          <h2>Connexion</h2>
          <button onClick={connectExtension}>Connexion via SubWallet/Polkadot.js</button>
          <div>
            <input
              type="text"
              placeholder="Phrase mnémotechnique"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
            />
            <button onClick={connectMnemonic}>Connexion via Mnémotechnique</button>
          </div>
        </>
      )}

      <div>
        <h2>Charger un fichier CSV</h2>
        <input type="file" accept=".csv" onChange={handleCSVUpload} />
      </div>

      {wallets.length > 0 && (
        <>
          <h2>Destinataires</h2>
          <ul>
            {wallets.map((w, i) => (
              <li key={i}>
                {w.address} — {w.amount} CAPS
                {simulated && simulationResults[i] && (
                  <span> — Frais estimés: {simulationResults[i].fee} CAPS</span>
                )}
              </li>
            ))}
          </ul>
          <button onClick={simulateTransfers}>Simuler</button>
          {simulated && <button onClick={confirmAndSend}>Envoyer</button>}
        </>
      )}
    </div>
  );
}
