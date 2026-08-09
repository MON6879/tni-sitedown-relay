import requests
gids = ['0', '610944071', '133591305', '1684930643', '1526435054', '1802115162', '454483758', '1183351980', '987518593']
for g in gids:
    url = f'https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?tqx=out:csv&gid={g}'
    res = requests.get(url)
    first_line = res.text.split('\n')[0] if res.text else ''
    second_line = res.text.split('\n')[1] if len(res.text.split('\n')) > 1 else ''
    fourth_line = res.text.split('\n')[3] if len(res.text.split('\n')) > 3 else ''
    print(f'GID {g}: len={len(res.text)} | line1={first_line[:50]} | line4={fourth_line[:50]}')
