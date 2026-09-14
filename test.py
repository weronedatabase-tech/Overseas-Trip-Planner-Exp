import urllib.request
url = 'https://raw.githubusercontent.com/tbsu/google-contacts-csv-template/master/google_contacts_template.csv'
try:
    print(urllib.request.urlopen(url).read().decode('utf-8')[:300])
except Exception as e:
    print(e)
