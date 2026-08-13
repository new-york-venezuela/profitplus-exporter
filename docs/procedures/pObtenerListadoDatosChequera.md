# SP: pObtenerListadoDatosChequera
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequera`](../tables/saChequera.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoChequera]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosChequera]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
      @sTable_Name					VARCHAR(50)			= NULL ,
      
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
      @bAplica_Estatus				BIT					= NULL,
      @sEstatus						CHAR(3)					= NULL,
      
      @bAplica_Cuenta				BIT					= NULL,
      @sCuenta						CHAR(6)				= NULL,
      
	  @bAplica_Banco				BIT					= NULL,
      @sBanco						CHAR(6)				= NULL,

      @bAplica_Fecha				BIT					= NULL,
      @dFechaRec_Desde				SMALLDATETIME		= NULL,
      @dFechaRec_Hasta				SMALLDATETIME		= NULL,
            
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
					   FROM ' + CONVERT(NVARCHAR(100), @sTable_Name) + 
					   ' INNER JOIN saCuentaBancaria on saChequera.Cod_cta = saCuentaBancaria.Cod_cta'				
					   + ' WHERE '
				
		IF (@sValor <> '')
			BEGIN
				IF ( @iOpcion = 0 )--Inicia en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), + @sTable_Name + '.' + @sField_Name) + N' LIKE '''
							+ CONVERT(NVARCHAR(30), @sValor) + '%'''
					END

				IF ( @iOpcion = 1 )--Termina en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), + @sTable_Name + '.' + @sField_Name) + N' LIKE ''%'
							+ CONVERT(NVARCHAR(30), @sValor) + ''''
					END

				IF ( @iOpcion = 2 )--Contiene
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), + @sTable_Name + '.' + @sField_Name) + N' LIKE ''%'
							+ @sValor + '%'''
					END
			
				IF ( @iOpcion = 3 )--Es Igual
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), + @sTable_Name +
```
