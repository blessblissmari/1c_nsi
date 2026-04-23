import os, sys
os.chdir(r'C:\Users\bliss\Documents\Code\1c_nsi\backend')
os.environ['DATABASE_URL'] = 'sqlite:///C:/Users/bliss/Documents/Code/1c_nsi/backend/nsi_data.db'

if __name__ == '__main__':
    from multiprocessing import freeze_support
    freeze_support()
    sys.argv = ['uvicorn', 'app.main:app', '--port', '8000']
    from uvicorn.main import main
    main()
