# SP: pObtenerListadoDatosIncoterm
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saIncoterm`](../tables/saIncoterm.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
 NOMBRE: [pObtenerListadoDatosIncoterm]
 DESCRIPCION: Obtiene la lista de los registros de Incoterms dado el número de secuencia correspondiente y
			  el (los) tipo(s) de transporte para el (los) que aplique dicho Incoterm
 CREADO POR: Softech Consultores
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosIncoterm]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,     
	  
	  @bAplica_Secuencia			BIT					= NULL,
	  @iSecuencia					INT					= NULL,

	  @bAplica_TipoTrans			BIT					= NULL,
	  @bMaritimo					BIT					= NULL,
	  @bTerrestre					BIT					= NULL,
	  @bAereo						BIT					= NULL,
      
      @iOpcion						INT					= NULL
    )
AS 
    BEGIN	
        DECLARE @SqlString		NVARCHAR(MAX)
        DECLARE @operadorLogico CHAR(4)
        
        IF (@bUsaOperadorLogicoAND = 1)
			SET @operadorLogico = ' AND'
		ELSE 
			SET @operadorLogico = ' OR'
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *    
					   FROM ' + CONVERT(NVARCHAR(100), 'saIncoterm') + ' WHERE '
		
		IF (@sValor <> '')
			BEGIN
				IF ( @iOpcion = 0 )--Inicia en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE '''
							+ CONVERT(NVARCHAR(30), @sValor) + '%'''
					END

				IF ( @iOpcion = 1 )--Termina en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
							+ CONVERT(NVARCHAR(30), @sValor) + ''''
					END

				IF ( @iOpcion = 2 )--Contiene
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
							+ @sValor + '%'''
					END
			
				IF ( @iOpcion = 3 )--Es Igual
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' = '''
							+ CONVERT(NVARCHAR(30), @sValor) + ''''
					END
			
				IF ( @iOpcion = 4 )--Fonetica
					BEGIN
						SET @SqlString = @SqlString + N' dbo.SoundexBusqueda(' + CONVERT(NVARCHAR(100), @sField_Name) + N','''
							+ CONVERT(NVARCHAR(30), @sValor) + N''') > 3'
```
