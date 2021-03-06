import { expect } from "chai";
import { ethers } from "hardhat";

async function getContractFactory() {
  return ethers.getContractFactory("PassphraseControlled");
}

// default test values
const _name = "test passphrase owned account";
const _hint = "test hint";
const _passphrase = "test passphrase";
const _passphraseHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(_passphrase)
);
const _unlockPeriod = 10;
const _provisionalLockPeriod = 10;
const _provisionalUnlockDeposit = ethers.utils.parseEther("0.1");

const _provisionalHint = "provisional hint";
const _provisionalPassphraseHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("new provisional passphrase hash")
);

async function getTestContract() {
  const PassphraseControlled = await getContractFactory();

  const passphraseControlled = await PassphraseControlled.deploy(
    _name,
    _hint,
    _passphraseHash,
    _unlockPeriod,
    _provisionalLockPeriod,
    _provisionalUnlockDeposit
  );

  return passphraseControlled;
}

async function getProvisionallyUnlockedContract() {
  const passphraseControlled = await getTestContract();

  await passphraseControlled.provisionalUnlock(
    _provisionalHint,
    _provisionalPassphraseHash,
    { value: _provisionalUnlockDeposit }
  );

  return passphraseControlled;
}

async function getUnlockedContract() {
  const passphraseControlled = await getProvisionallyUnlockedContract();

  await passphraseControlled.unlock(_passphrase);

  return passphraseControlled;
}

describe("PassphraseControlled", function () {
  context("constructor", function () {
    it("Should revert if unlockPeriod is 0", async function () {
      const PassphraseControlled = await getContractFactory();

      await expect(
        PassphraseControlled.deploy(
          "test passphrase owned account", // name
          "test hint", // hint
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test passphrase")), // passphraseHash
          0, // unlockPeriod
          0, // provisionalUnlockDeposit
          0 // provisionalLockPeriod
        )
      ).to.be.revertedWith("Unlock period must be > 0");
    });

    it("Should revert if provisionalLockPeriod is 0", async function () {
      const PassphraseControlled = await getContractFactory();

      await expect(
        PassphraseControlled.deploy(
          "test passphrase owned account", // name
          "test hint", // hint
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test passphrase")), // passphraseHash
          10, // unlockPeriod
          0, // provisionalUnlockDeposit
          0 // provisionalLockPeriod
        )
      ).to.be.revertedWith("Provisional lock period must be > 0");
    });

    it("Should set all fields as expected", async function () {
      const passphraseControlled = await getTestContract();

      const [
        name,
        hint,
        passphraseHash,
        lockedAt,
        controller,
        provisionalController,
        unlockPeriod,
        provisionalUnlockDeposit,
        provisionalLockPeriod,
        provisionallyLockedUntil,
      ] = await Promise.all([
        passphraseControlled.name(),
        passphraseControlled.hint(),
        passphraseControlled.passphraseHash(),
        passphraseControlled.lockedAt(),
        passphraseControlled.controller(),
        passphraseControlled.provisionalController(),
        passphraseControlled.unlockPeriod(),
        passphraseControlled.provisionalUnlockDeposit(),
        passphraseControlled.provisionalLockPeriod(),
        passphraseControlled.provisionallyLockedUntil(),
      ]);

      const currentBlock = await ethers.provider.getBlockNumber();

      expect(name).to.eql(_name);
      expect(hint).to.eql(_hint);
      expect(passphraseHash).to.eql(_passphraseHash);
      expect(lockedAt.toNumber()).to.eql(currentBlock);
      expect(provisionallyLockedUntil.toNumber()).to.eql(currentBlock);
      expect(controller).to.eql("0x0000000000000000000000000000000000000000");
      expect(provisionalController).to.eql(
        "0x0000000000000000000000000000000000000000"
      );
      expect(unlockPeriod.toNumber()).to.eql(_unlockPeriod);
      expect(provisionalLockPeriod.toNumber()).to.eql(_provisionalLockPeriod);
      expect(provisionalUnlockDeposit).to.eql(_provisionalUnlockDeposit);
    });
  });

  context("provisionalUnlock", function () {
    it("Should revert if account is already unlocked", async function () {
      const provisionallyUnlocked = await getProvisionallyUnlockedContract();

      await provisionallyUnlocked.unlock(_passphrase);

      await expect(
        provisionallyUnlocked.provisionalUnlock(
          "new provisional hint",
          ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("new provisional passphrase hash")
          )
        )
      ).to.be.revertedWith("Account is unlocked");
    });

    it("Should revert if passphrase is not changing", async function () {
      const passphraseControlled = await getTestContract();

      await expect(
        passphraseControlled.provisionalUnlock(_hint, _passphraseHash)
      ).to.be.revertedWith("Provisional passphrase same as current passphrase");
    });

    it("Should revert if deposit not provided", async function () {
      const passphraseControlled = await getTestContract();

      await expect(
        passphraseControlled.provisionalUnlock(
          _hint,
          _provisionalPassphraseHash,
          {
            value: 0,
          }
        )
      ).to.be.revertedWith("Deposit required");
    });

    it("Should revert if provisionally unlocking within the provisional lock period", async function () {
      const passphraseControlled = await getTestContract();

      await passphraseControlled.provisionalUnlock(
        _hint,
        _provisionalPassphraseHash,
        {
          value: _provisionalUnlockDeposit,
        }
      );

      await expect(
        passphraseControlled.provisionalUnlock(
          _hint,
          _provisionalPassphraseHash,
          {
            value: _provisionalUnlockDeposit,
          }
        )
      ).to.be.revertedWith("Provisionally locked");
    });

    it("Should set all fields as expected", async function () {
      const passphraseControlled = await getTestContract();

      const _provisionalHint = "new provisional hint";
      const _provisionalPassphraseHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("new provisional passphrase hash")
      );

      await passphraseControlled.provisionalUnlock(
        _provisionalHint,
        _provisionalPassphraseHash,
        {
          value: _provisionalUnlockDeposit,
        }
      );

      const currentBlock = await ethers.provider.getBlockNumber();

      const [
        provisionalController,
        provisionalHint,
        provisionalPassphraseHash,
        provisionalLockPeriod,
        provisionallyLockedUntil,
        [signer],
      ] = await Promise.all([
        passphraseControlled.provisionalController(),
        passphraseControlled.provisionalHint(),
        passphraseControlled.provisionalPassphraseHash(),
        passphraseControlled.provisionalLockPeriod(),
        passphraseControlled.provisionallyLockedUntil(),
        ethers.getSigners(),
      ]);

      expect(provisionalController).to.eql(signer.address);
      expect(provisionalHint).to.eql(provisionalHint);
      expect(provisionalPassphraseHash).to.eql(provisionalPassphraseHash);
      expect(provisionallyLockedUntil).to.eql(
        provisionalLockPeriod.add(currentBlock)
      );
    });

    it("Should emit ProvisionallyUnlocked event", async function () {
      const passphraseControlled = await getTestContract();

      const _provisionalHint = "new provisional hint";
      const _provisionalPassphraseHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("new provisional passphrase hash")
      );

      const [signer] = await ethers.getSigners();

      await expect(
        passphraseControlled.provisionalUnlock(
          _provisionalHint,
          _provisionalPassphraseHash,
          {
            value: _provisionalUnlockDeposit,
          }
        )
      )
        .to.emit(passphraseControlled, "ProvisionallyUnlocked")
        .withArgs(signer.address, _provisionalHint, _provisionalPassphraseHash);
    });
  });

  context("unlock", function () {
    it("Should revert if account is already unlocked", async function () {
      const provisionallyUnlocked = await getProvisionallyUnlockedContract();

      await provisionallyUnlocked.unlock(_passphrase);

      await expect(
        provisionallyUnlocked.unlock(_passphrase)
      ).to.be.revertedWith("Account is unlocked");
    });

    it("Should revert if passphrase is incorrect", async function () {
      const provisionallyUnlocked = await getProvisionallyUnlockedContract();

      await expect(
        provisionallyUnlocked.unlock("incorrect passphrase")
      ).to.be.revertedWith("Incorrect passphrase");
    });

    it("Should revert if caller is not provisional controller", async function () {
      const provisionallyUnlocked = await getProvisionallyUnlockedContract();

      const [, otherAccount] = await ethers.getSigners();

      const asOtherAccount = await provisionallyUnlocked.connect(otherAccount);

      await expect(asOtherAccount.unlock(_passphrase)).to.be.revertedWith(
        "Not provisional controller"
      );
    });

    it("Should set all fields as expected", async function () {
      const passphraseControlled = await getProvisionallyUnlockedContract();

      await passphraseControlled.unlock(_passphrase);

      const currentBlock = await ethers.provider.getBlockNumber();

      const [lockedAt, controller, hint, passphraseHash, [signer]] =
        await Promise.all([
          passphraseControlled.lockedAt(),
          passphraseControlled.controller(),
          passphraseControlled.hint(),
          passphraseControlled.passphraseHash(),
          ethers.getSigners(),
        ]);

      expect(lockedAt.toNumber()).to.eql(currentBlock + _unlockPeriod);
      expect(controller).to.eql(signer.address);
      expect(hint).to.eql(_provisionalHint);
      expect(passphraseHash).to.eql(_provisionalPassphraseHash);
      expect(passphraseHash).to.eql(_provisionalPassphraseHash);
    });

    it("Should emit an Unlocked event", async function () {
      const passphraseControlled = await getProvisionallyUnlockedContract();

      const [[signer], unlockPeriod] = await Promise.all([
        ethers.getSigners(),
        passphraseControlled.unlockPeriod(),
      ]);

      const caughtCall = expect(await passphraseControlled.unlock(_passphrase));

      const currentBlock = await ethers.provider.getBlockNumber();

      const expectedLockedAt = currentBlock + unlockPeriod.toNumber();

      await caughtCall.to
        .emit(passphraseControlled, "Unlocked")
        .withArgs(
          signer.address,
          _provisionalHint,
          _provisionalPassphraseHash,
          expectedLockedAt
        );
    });
  });

  context("setUnlockPeriod", function () {
    it("Should revert if account is locked", async function () {
      const passphraseControlled = await getTestContract();

      await expect(passphraseControlled.setUnlockPeriod(5)).to.be.revertedWith(
        "Account is locked"
      );
    });

    it("Should revert if caller is not controller", async function () {
      const unlockedContract = await getUnlockedContract();

      const [, otherAccount] = await ethers.getSigners();

      const asOtherAccount = await unlockedContract.connect(otherAccount);

      await expect(asOtherAccount.setUnlockPeriod(5)).to.be.revertedWith(
        "Not controller"
      );
    });

    it("Should revert if new unlock period is 0", async function () {
      const unlockedContract = await getUnlockedContract();

      await expect(unlockedContract.setUnlockPeriod(0)).to.be.revertedWith(
        "Unlock period must be > 0"
      );
    });

    it("Should set unlockPeriod to new value", async function () {
      const unlockedContract = await getUnlockedContract();

      const _unlockPeriod = 5;
      await unlockedContract.setUnlockPeriod(_unlockPeriod);

      const unlockPeriod = await unlockedContract.unlockPeriod();

      expect(unlockPeriod.toNumber()).to.eql(_unlockPeriod);
    });

    it("Should emit an UnlockPeriodUpdated event", async function () {
      const unlockedContract = await getUnlockedContract();

      const _unlockPeriod = 5;
      await unlockedContract.setUnlockPeriod(_unlockPeriod);

      await expect(unlockedContract.setUnlockPeriod(_unlockPeriod))
        .to.emit(unlockedContract, "UnlockPeriodUpdated")
        .withArgs(_unlockPeriod);
    });
  });

  context("setProvisionalLockPeriod", function () {
    it("Should revert if account is locked", async function () {
      const passphraseControlled = await getTestContract();

      await expect(
        passphraseControlled.setProvisionalLockPeriod(5)
      ).to.be.revertedWith("Account is locked");
    });

    it("Should revert if caller is not controller", async function () {
      const unlockedContract = await getUnlockedContract();

      const [, otherAccount] = await ethers.getSigners();

      const asOtherAccount = await unlockedContract.connect(otherAccount);

      await expect(
        asOtherAccount.setProvisionalLockPeriod(5)
      ).to.be.revertedWith("Not controller");
    });

    it("Should revert if new provisional lock period is 0", async function () {
      const unlockedContract = await getUnlockedContract();

      await expect(
        unlockedContract.setProvisionalLockPeriod(0)
      ).to.be.revertedWith("Provisional lock period must be > 0");
    });

    it("Should set provisionalLockPeriod to new value", async function () {
      const unlockedContract = await getUnlockedContract();

      const _provisionalLockPeriod = 5;
      await unlockedContract.setProvisionalLockPeriod(_provisionalLockPeriod);

      const provisionalLockPeriod =
        await unlockedContract.provisionalLockPeriod();

      expect(provisionalLockPeriod.toNumber()).to.eql(_provisionalLockPeriod);
    });

    it("Should emit an ProvisionalLockPeriodUpdated event", async function () {
      const unlockedContract = await getUnlockedContract();

      const _provisionalLockPeriod = 5;
      await unlockedContract.setProvisionalLockPeriod(_provisionalLockPeriod);

      await expect(
        unlockedContract.setProvisionalLockPeriod(_provisionalLockPeriod)
      )
        .to.emit(unlockedContract, "ProvisionalLockPeriodUpdated")
        .withArgs(_provisionalLockPeriod);
    });
  });

  context("setProvisionalUnlockDeposit", function () {
    it("Should revert if account is locked", async function () {
      const passphraseControlled = await getTestContract();

      await expect(
        passphraseControlled.setProvisionalUnlockDeposit(
          ethers.utils.parseEther("5")
        )
      ).to.be.revertedWith("Account is locked");
    });

    it("Should revert if caller is not controller", async function () {
      const unlockedContract = await getUnlockedContract();

      const [, otherAccount] = await ethers.getSigners();

      const asOtherAccount = await unlockedContract.connect(otherAccount);

      await expect(
        asOtherAccount.setProvisionalUnlockDeposit(ethers.utils.parseEther("5"))
      ).to.be.revertedWith("Not controller");
    });

    it("Should set provisionalUnlockDeposit to new value", async function () {
      const unlockedContract = await getUnlockedContract();

      const depositAmount = ethers.utils.parseEther("5");
      await unlockedContract.setProvisionalUnlockDeposit(depositAmount);

      const provisionalUnlockDeposit =
        await unlockedContract.provisionalUnlockDeposit();

      expect(provisionalUnlockDeposit).to.eql(depositAmount);
    });

    it("Should emit ProvisionalUnlockDepositUpdated event", async function () {
      const unlockedContract = await getUnlockedContract();

      const depositAmount = ethers.utils.parseEther("5");
      await unlockedContract.setProvisionalUnlockDeposit(depositAmount);

      await expect(unlockedContract.setProvisionalUnlockDeposit(depositAmount))
        .to.emit(unlockedContract, "ProvisionalUnlockDepositUpdated")
        .withArgs(depositAmount);
    });
  });

  context("execute", function () {
    it("Should revert if account is locked", async function () {
      const passphraseControlled = await getTestContract();

      await expect(passphraseControlled.setUnlockPeriod(5)).to.be.revertedWith(
        "Account is locked"
      );
    });

    it("Should revert if caller is not controller", async function () {
      const unlockedContract = await getUnlockedContract();

      const [, otherAccount] = await ethers.getSigners();

      const asOtherAccount = await unlockedContract.connect(otherAccount);

      await expect(asOtherAccount.setUnlockPeriod(5)).to.be.revertedWith(
        "Not controller"
      );
    });

    it("Should revert if no targets are provided", async function () {
      const unlockedContract = await getUnlockedContract();

      await expect(unlockedContract.execute([], [], [])).to.be.revertedWith(
        "No targets provided"
      );
    });

    it("Should revert if # of targets does not match # of calldata items", async function () {
      const unlockedContract = await getUnlockedContract();

      const [, otherAccount] = await ethers.getSigners();

      await expect(
        unlockedContract.execute([otherAccount.address], [], [])
      ).to.be.revertedWith("Argument length mismatch");
    });

    it("Should revert if # of targets does not match # of values", async function () {
      const unlockedContract = await getUnlockedContract();

      const [, otherAccount] = await ethers.getSigners();

      await expect(
        unlockedContract.execute([otherAccount.address], ["0x"], [])
      ).to.be.revertedWith("Argument length mismatch");
    });

    it("Should execute a call to a single target", async function () {
      const unlockedContract = await getUnlockedContract();

      const [signer, otherAccount] = await ethers.getSigners();

      const [signerBalanceBefore, otherBalanceBefore] = await Promise.all([
        ethers.provider.getBalance(signer.address),
        ethers.provider.getBalance(otherAccount.address),
      ]);

      // send 1 eth from signer to deployed contract
      await signer.sendTransaction({
        to: unlockedContract.address,
        value: ethers.utils.parseEther("1"),
      });

      const oneEth = ethers.utils.parseEther("1");
      // use execute to send 1 eth from passphrase owned contract to other account
      await unlockedContract.execute([otherAccount.address], ["0x"], [oneEth]);

      const [signerBalanceAfter, otherBalanceAfter] = await Promise.all([
        ethers.provider.getBalance(signer.address),
        ethers.provider.getBalance(otherAccount.address),
      ]);

      // sent 1 eth plus gas
      const signerBalanceChangedAsExpected = signerBalanceAfter.lt(
        signerBalanceBefore.sub(oneEth)
      );
      expect(signerBalanceChangedAsExpected).to.eql(true);
      expect(otherBalanceAfter).to.eql(otherBalanceBefore.add(oneEth));
    });

    it("Should execute calls to multiple targets", async function () {
      const unlockedContract = await getUnlockedContract();

      const [signer, otherAccount, anotherAccount] = await ethers.getSigners();

      const [signerBalanceBefore, otherBalanceBefore, anotherBalanceBefore] =
        await Promise.all([
          ethers.provider.getBalance(signer.address),
          ethers.provider.getBalance(otherAccount.address),
          ethers.provider.getBalance(anotherAccount.address),
        ]);

      // send 1 eth from signer to deployed contract
      await signer.sendTransaction({
        to: unlockedContract.address,
        value: ethers.utils.parseEther("2.5"),
      });

      const oneEth = ethers.utils.parseEther("1");
      const onePointFiveEth = ethers.utils.parseEther("1.5");

      // use execute to send 1 eth from passphrase owned contract to other account
      await unlockedContract.execute(
        [otherAccount.address, anotherAccount.address],
        ["0x", "0x"],
        [oneEth, onePointFiveEth]
      );

      const [signerBalanceAfter, otherBalanceAfter, anotherBalanceAfter] =
        await Promise.all([
          ethers.provider.getBalance(signer.address),
          ethers.provider.getBalance(otherAccount.address),
          ethers.provider.getBalance(anotherAccount.address),
        ]);

      // sent 2 eth plus gas
      const signerBalanceChangedAsExpected = signerBalanceAfter.lt(
        signerBalanceBefore.sub(oneEth).sub(onePointFiveEth)
      );

      expect(signerBalanceChangedAsExpected).to.eql(true);
      expect(otherBalanceAfter).to.eql(otherBalanceBefore.add(oneEth));
      expect(anotherBalanceAfter).to.eql(
        anotherBalanceBefore.add(onePointFiveEth)
      );
    });

    it("Should perform all calls atomically", async function () {
      const unlockedContract = await getUnlockedContract();

      const [signer, otherAccount, anotherAccount] = await ethers.getSigners();

      const [otherBalanceBefore, anotherBalanceBefore] = await Promise.all([
        ethers.provider.getBalance(otherAccount.address),
        ethers.provider.getBalance(anotherAccount.address),
      ]);

      // send insufficient amount of eth to contract
      await signer.sendTransaction({
        to: unlockedContract.address,
        value: ethers.utils.parseEther("2"), // this is not enough and causes execute() to fail
      });

      const oneEth = ethers.utils.parseEther("1");
      const onePointFiveEth = ethers.utils.parseEther("1.5");

      // use execute to send 1 eth from passphrase owned contract to other account
      await expect(
        unlockedContract.execute(
          [otherAccount.address, anotherAccount.address],
          ["0x", "0x"],
          [oneEth, onePointFiveEth]
        )
      ).to.be.revertedWith("One or more calls failed");

      const [otherBalanceAfter, anotherBalanceAfter] = await Promise.all([
        ethers.provider.getBalance(otherAccount.address),
        ethers.provider.getBalance(anotherAccount.address),
      ]);

      // neither balance should be updated since one of the calls failed
      expect(otherBalanceAfter).to.eql(otherBalanceBefore);
      expect(anotherBalanceAfter).to.eql(anotherBalanceBefore);
    });
  });
});
