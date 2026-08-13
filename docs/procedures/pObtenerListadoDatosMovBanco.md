# SP: pObtenerListadoDatosMovBanco
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosMovBanco]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO: <2012-07-26>
MODIFICADO: <2020-06-26>
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosMovBanco]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
      @sTable_Name					VARCHAR(50)			= NULL ,
      
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
      @bAplica_Anulado				BIT					= NULL,
      @bAnulado						BIT					= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,
      
      @bAplica_Cuenta				BIT					= NULL,
      @sCuenta						CHAR(6)				= NULL,
      
      @bAplica_Tipo_mov				BIT					= NULL,
      @sTipo_mov					CHAR(2)				= NULL,
      
      @bAplica_Num_doc				BIT					= NULL,
      @sNum_doc						VARCHAR(20)			= NULL,
      
      @bAplica_Banco				BIT					= NULL,
      @sBanco						CHAR(6)				= NULL,
      
      @bAplica_Cta_ing				BIT					= NULL,
      @sCta_ing						CHAR(20)			= NULL,
      
      @bAplica_Monto				BIT					= NULL,
      @dMonto_Desde					decimal(18, 2)		= NULL,
      @dMonto_Hasta					decimal(18, 2)		= NULL,
      
      @bAplica_Sucursal				BIT					= NULL,
	  @sSucursal					CHAR(10)			= NULL,
      
      @bAplica_Nro_Comrpobante		BIT					= NULL,
      @sNro_Comrpobante				INT					= NULL,
     	  
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
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *, CONVERT(decimal(18,2),(case when monto_d > 0 then monto_d else monto_h end)) as monto         
					   FROM ' + CONVERT(NVARCHAR(100), @sTable_Name) +
				
				' INNER JOIN sacuentabancaria on saMovimientoBanco.cod_cta = sacuentabancaria.cod_cta
				INNER JOIN saBanco on  sacuentabancaria.co_ban = saBa
```
