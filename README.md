# First

Make a Repository ((Private))





# Monad Testnet Bot

This is a JavaScript bot script designed to interact with the Monad testnet.

## Installation

1. Clone the Repository

Clone this repository to your local machine using the following command:

```bash
git clone https://github.com/vicktorynox/autoswap-monad.git
cd autoswap-monad
```

2. Install the required dependencies:

   ```bash
   npm install
   ```

## Configuration

1.  **Rename `.env.example`** to .env

```bash
  cp .env.example .env
```

2. **Edit the `.env.`** file
   Replace your_evm_private_key with your actual EVM wallet private key. It should look like this:
   ```bash
   nano .env
   PRIVATE_KEY=0x1234...
   ```
ctrl+s and then ctrl+x

## Usage

To run the bot, use the following command:

```bash
npm start
```

The bot will start processing each wallet based on the configured.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
