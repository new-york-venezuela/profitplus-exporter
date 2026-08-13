# SP: pObtenerListadoDatosDepositoBancario
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosDepositoBancario]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
Create PROCEDURE [dbo].[pObtenerListadoDatosDepositoBancario]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
      @bAplica_Procesado			BIT					= NULL,
      @bProcesado					BIT					= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,
      
      @bAplica_Cuenta				BIT					= NULL,
      @sCuenta						CHAR(6)				= NULL,
      
      @bAplica_Cuentaing			BIT					= NULL,
      @sCuentaing					CHAR(20)			= NULL,
      
      @bAplica_Numeroplan			BIT					= NULL,
      @sNumeroplan					CHAR(2)				= NULL,
      
      @bAplica_Caja					BIT					= NULL,
      @sCaja						CHAR(6)				= NULL,
      
      @bAplica_TotalEfec			BIT					= NULL,
      @dTotal_EfecDesde				decimal(18, 2)		= NULL,
      @dTotal_EfecHasta				decimal(18, 2)		= NULL,
      
      @bAplica_CajaDet				BIT					= NULL,
      @sCajaDet						CHAR(6)				= NULL,
      
      @bAplica_Tipo					BIT					= NULL,
      @sTipo						CHAR(2)				= NULL,
      
      @bAplica_Numero				BIT					= NULL,
      @sNumero						CHAR(20)			= NULL,
      
	  @bAplica_TotalDep				BIT					= NULL,
      @dTotal_DepDesde				decimal(18, 2)		= NULL,
      @dTotal_DepHasta				decimal(18, 2)		= NULL,
      
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
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *    
					   FROM ' + CONVERT(NVARCHAR(100), 'sa
```
