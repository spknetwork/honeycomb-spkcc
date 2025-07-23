#!/bin/bash

# Run Capital Interface Tests
echo "Running Capital Interface Tests..."
echo "================================"

# Set NODE_ENV to test
export NODE_ENV=test

# Check if mocha is installed
if ! command -v mocha &> /dev/null; then
    echo "Mocha not found. Installing test dependencies..."
    npm install --save-dev mocha chai sinon
fi

# Run the tests with detailed output
echo "Executing test suite..."
mocha test/capital_interfaces_test.js \
    --reporter spec \
    --timeout 10000 \
    --exit

# Check test results
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All capital interface tests passed!"
    echo ""
    echo "Test Coverage Areas:"
    echo "- Bonding Curve Calculations"
    echo "- Collateral Limit Checking" 
    echo "- LP Pool Rebalancing"
    echo "- Token Distribution"
    echo "- Liquidity Provision"
    echo "- Swap Execution"
    echo "- Integration Scenarios"
    echo "- Edge Cases"
else
    echo ""
    echo "❌ Some tests failed. Please check the output above."
    exit 1
fi

# Optional: Run with coverage if nyc is available
if command -v nyc &> /dev/null; then
    echo ""
    echo "Running with coverage analysis..."
    nyc mocha test/capital_interfaces_test.js --exit
fi