"""
Setup script to help configure the Cloud Storage Sync Tool backend.
Run this to generate secure keys and validate configuration.
"""

import secrets
from cryptography.fernet import Fernet
import os


def generate_keys():
    """Generate secure keys for the application."""
    print("\n" + "="*60)
    print("SECURE KEY GENERATION")
    print("="*60)
    
    secret_key = secrets.token_urlsafe(32)
    token_encryption_key = Fernet.generate_key().decode()
    
    print("\n✅ Generated secure keys!")
    print("\nAdd these to your .env file:\n")
    print(f"SECRET_KEY={secret_key}")
    print(f"TOKEN_ENCRYPTION_KEY={token_encryption_key}")
    print("\n" + "="*60)
    
    return secret_key, token_encryption_key


def check_env_file():
    """Check if .env file exists and is configured."""
    print("\n" + "="*60)
    print("ENVIRONMENT FILE CHECK")
    print("="*60)
    
    if not os.path.exists('.env'):
        print("\n❌ .env file not found!")
        print("\n📝 Creating .env from .env.example...")
        
        if os.path.exists('.env.example'):
            with open('.env.example', 'r') as f:
                content = f.read()
            
            with open('.env', 'w') as f:
                f.write(content)
            
            print("✅ Created .env file")
            print("\n⚠️  You still need to update the following in .env:")
            print("   - SECRET_KEY")
            print("   - TOKEN_ENCRYPTION_KEY")
            print("   - GOOGLE_CLIENT_ID")
            print("   - GOOGLE_CLIENT_SECRET")
        else:
            print("❌ .env.example not found!")
            return False
    else:
        print("\n✅ .env file found")
        
        # Check for required variables
        with open('.env', 'r') as f:
            content = f.read()
        
        required = [
            'SECRET_KEY',
            'TOKEN_ENCRYPTION_KEY',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET'
        ]
        
        missing = []
        not_configured = []
        
        for var in required:
            if var not in content:
                missing.append(var)
            elif f'{var}=CHANGE_ME' in content or f'{var}=your-' in content:
                not_configured.append(var)
        
        if missing:
            print(f"\n❌ Missing variables: {', '.join(missing)}")
        
        if not_configured:
            print(f"\n⚠️  Not configured: {', '.join(not_configured)}")
            print("\n   Run this script to generate secure keys!")
        
        if not missing and not not_configured:
            print("\n✅ All required variables are configured!")
            return True
    
    print("\n" + "="*60)
    return False


def check_dependencies():
    """Check if required dependencies are installed."""
    print("\n" + "="*60)
    print("DEPENDENCY CHECK")
    print("="*60)
    
    required_packages = [
        'fastapi',
        'uvicorn',
        'sqlmodel',
        'google-auth',
        'azure-storage-blob',
        'aiofiles',
        'cryptography'
    ]
    
    missing = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package}")
            missing.append(package)
    
    if missing:
        print(f"\n⚠️  Missing packages: {', '.join(missing)}")
        print("\nInstall with: pip install -r requirements.txt")
    else:
        print("\n✅ All required packages are installed!")
    
    print("\n" + "="*60)
    return len(missing) == 0


def display_next_steps(env_configured):
    """Display next steps for setup."""
    print("\n" + "="*60)
    print("NEXT STEPS")
    print("="*60)
    
    if not env_configured:
        print("\n1. Update your .env file with:")
        print("   - Generated SECRET_KEY and TOKEN_ENCRYPTION_KEY (see above)")
        print("   - Google OAuth credentials from Google Cloud Console")
        print("   - (Optional) Azure Storage connection string")
    else:
        print("\n✅ Configuration complete!")
    
    print("\n2. Set up Google Cloud Console:")
    print("   - Go to https://console.cloud.google.com/")
    print("   - Create a project")
    print("   - Enable Google Drive API")
    print("   - Create OAuth 2.0 credentials")
    print("   - Add redirect URI: http://localhost:8000/auth/google/callback")
    
    print("\n3. Run the application:")
    print("   uvicorn app.main:app --reload")
    
    print("\n4. Access the API:")
    print("   - API: http://localhost:8000")
    print("   - Docs: http://localhost:8000/docs")
    print("   - Health: http://localhost:8000/health")
    
    print("\n5. Test the API:")
    print("   - Register a user")
    print("   - Connect Google Drive")
    print("   - Upload a file")
    
    print("\n" + "="*60)
    print("\n📚 For more help, see:")
    print("   - README.md - Complete documentation")
    print("   - QUICKSTART.md - 5-minute setup guide")
    print("   - DEPLOYMENT.md - Production deployment")
    print("\n" + "="*60)


def main():
    """Main setup function."""
    print("\n" + "="*60)
    print("CLOUD STORAGE SYNC TOOL - BACKEND SETUP")
    print("="*60)
    
    # Check dependencies
    deps_ok = check_dependencies()
    
    # Check environment file
    env_ok = check_env_file()
    
    # Generate keys
    if not env_ok:
        print("\n💡 Generating secure keys for you...")
        generate_keys()
    
    # Display next steps
    display_next_steps(env_ok)
    
    if deps_ok and env_ok:
        print("\n🎉 Setup complete! You're ready to run the application.")
    else:
        print("\n⚠️  Please complete the steps above before running the application.")


if __name__ == '__main__':
    main()
