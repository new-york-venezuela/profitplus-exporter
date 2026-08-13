# SP: pActualizarDepositoBanco
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBanco`](../tables/saDepositoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
CREADO			:	<2011-12-12>
MODIFICADO		:	<2020-07-27>
NOMBRE		: pActualizarDepositoBanco
DESCRIPCION	: Actualiza un registro de la tabla saDepositoBanco
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarDepositoBanco]
    (
      @sDep_Num CHAR(20) ,
      @sDep_NumOri CHAR(20) ,
      @sDeposito CHAR(10) ,
      @sdFecha SMALLDATETIME ,
      @smov_num_b CHAR(20) ,
      @sCod_Cta CHAR(6) ,
      @sCod_Caja CHAR(6) ,
      @smov_num_c CHAR(20) ,
      @deTotal_Efec DECIMAL(18, 5) ,
      @bActivado BIT ,
		--@deTotal_Cheq	DECIMAL(18,5),
		--@deTotal_Tarj	DECIMAL(18,5),
      @iChe_Dev INT ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @sdFecCom SMALLDATETIME = NULL ,
      @iNumCom INT = NULL ,
      @sDis_Cen VARCHAR(MAX) = NULL ,
      @deTasa DECIMAL(21, 8) ,
      @deAux01 DECIMAL(18, 5) ,
      @sAux02 VARCHAR(30) ,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
	
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            dbo.saDepositoBanco
        SET dep_num = @sDep_Num, deposito = @sDeposito, fecha = @sdFecha, mov_num_b = @smov_num_b, cod_cta = @sCod_Cta,
            cod_caja = @sCod_Caja, mov_num_c = @smov_num_c, total_efec = @deTotal_Efec, activado = @bActivado,
			--total_cheq	=	@deTotal_Cheq, 
			--total_tarj	=	@deTotal_Tarj, 
            che_dev = @iChe_Dev, co_cta_ingr_egr = @sCo_Cta_Ingr_Egr, feccom = @sdFecCom, numcom = @iNumCom,
            dis_cen = @sDis_Cen, tasa = @deTasa, aux01 = @deAux01, aux02 = @sAux02, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5,
```
