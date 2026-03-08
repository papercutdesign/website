export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = formData.get('category'); // 'ad' or 'logo'
    const slot = formData.get('slot'); // 1-20
    const password = formData.get('password');

    // 1. Verify Authentication
    if (password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Incorrect admin password" }), { 
          status: 401, headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (!file || !category || !slot) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
          status: 400, headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (category !== 'ad' && category !== 'logo') {
        return new Response(JSON.stringify({ error: "Invalid category" }), { 
            status: 400, headers: { 'Content-Type': 'application/json' } 
        });
    }

    // 2. Convert File to Base64 (for GitHub API)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Safely chunk the binary conversion to avoid Call Stack Exceeded on large files
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64Content = btoa(binary);

    // 3. Configure GitHub Variables
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || 'main'; // default to main
    
    // Determine the base path inside the repo where 'ad' and 'logo' folders live
    // Set REPO_BASE_PATH in Cloudflare env vars. E.g. 'papercut/website'
    const basePath = env.REPO_BASE_PATH ? `${env.REPO_BASE_PATH}/` : '';
    const filePath = `${basePath}${category}/${slot}.jpg`;

    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

    // 4. Check if the file already exists (to get its SHA for replacing)
    let sha = null;
    const getRes = await fetch(getUrl, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages-Admin',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
    }

    // 5. Commit the new file to GitHub
    const body = {
      message: `Admin Panel: Update ${category} slot ${slot}`,
      content: base64Content,
      branch: branch
    };

    // If it exists, we must include the old sha to overwrite it
    if (sha) {
      body.sha = sha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages-Admin',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const errorText = await putRes.text();
      return new Response(JSON.stringify({ 
          error: `GitHub API error: ${putRes.status}`, details: errorText 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Success response!
    return new Response(JSON.stringify({ 
        success: true, 
        message: "Image uploaded successfully! Cloudflare will rebuild your site within 1-2 minutes." 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ 
        error: err.message, stack: err.stack 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
