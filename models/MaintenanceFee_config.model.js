const mongoose = require('mongoose');
const schema = mongoose.Schema;

const maintenanceFeeSchema = new schema({
    maintenance_fee: { type: Number, require: true },
}, {
    timestamps: true,
})

const MaintenanceFee = mongoose.model('MaintenanceFee', maintenanceFeeSchema);
module.exports = MaintenanceFee;
