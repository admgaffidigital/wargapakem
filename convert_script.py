import re

def convert():
    try:
        with open('wargapakem.txt', 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        with open('wargapakem.txt', 'r', encoding='utf-16') as f:
            content = f.read()

    # 1. Remove XML declaration
    content = re.sub(r'<\?xml.*?\?>', '', content)
    
    # 2. Replace html tag
    content = re.sub(r'<html\s+b:css=.*?xmlns:expr=.*?>', '<html lang="id">', content, flags=re.DOTALL)
    
    # 3. Replace title
    content = content.replace('<data:view.title/>', 'Admin Warga RT')
    
    # 4. Replace b:skin
    content = content.replace('<b:skin><![CDATA[', '<style>')
    content = content.replace(']]></b:skin>', '</style>')
    
    # 5. Remove b:template-skin
    content = content.replace('<b:template-skin><![CDATA[]]></b:template-skin>', '')
    
    # 6. Remove b:section
    content = re.sub(r'<b:section.*?>\s*</b:section>', '', content, flags=re.DOTALL)
    content = re.sub(r'<b:section.*?/>', '', content)
    
    # Fix self closing root div
    content = content.replace("<div id='root'/>", "<div id='root'></div>")
    
    # Fix self closing script tags
    content = re.sub(r'<script(.*?)\s*/>', r'<script\1></script>', content)

    # 7. Write to index.html
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content.strip())
        
    print("Successfully converted wargapakem.txt to index.html!")

if __name__ == '__main__':
    convert()
