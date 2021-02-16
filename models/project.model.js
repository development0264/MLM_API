const mongoose = require('mongoose');

const schema = mongoose.Schema;

const projectSchema = new schema({
    title: { type: String, require: true },
    secondarytitle: { type: String, require: true },
    description: { type: String, require: true },
    logoName: { type: String, require: true },
    video_unique_id: { type: String, required: true },
    backName: { type: String, require: true },
    website_url: { type: String, require: true },
}, {
    timestamps: true,
})

const Project = mongoose.model('Projects', projectSchema);
module.exports = Project;
