import asyncio
from azure.storage.blob.aio import BlobServiceClient
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    conn_str = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    container = os.getenv('AZURE_CONTAINER_NAME')
    print(f'Testing Azure Blob Storage...')
    print(f'Container: {container}')
    
    try:
        client = BlobServiceClient.from_connection_string(conn_str)
        container_client = client.get_container_client(container)
        
        print('Checking if container exists...')
        exists = await container_client.exists()
        print(f'Exists: {exists}')
        
        if not exists:
            print('Creating container...')
            await container_client.create_container()
            print('Container created successfully!')
        else:
            print('Container already exists!')
        
        await client.close()
        print('\n✅ Azure connection test successful!')
        
    except Exception as e:
        print(f'\n❌ Error: {e}')
        print(f'Error type: {type(e).__name__}')

if __name__ == '__main__':
    asyncio.run(test())
