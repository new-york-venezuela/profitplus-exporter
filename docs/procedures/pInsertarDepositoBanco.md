# SP: pInsertarDepositoBanco
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBanco`](../tables/saDepositoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
CREADO			:	<2011-12-12>
MODIFICADO		:	<2020-07-27>NOMBRE		: pInsertarDepositoBanco
DESCRIPCION	: Inserta un registro de la tabla saDepositoBanco
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarDepositoBanco]
    (
      @sDep_Num CHAR(20) ,
      @sDeposito CHAR(10) ,
      @sdFecha SMALLDATETIME ,
      @smov_num_b CHAR(20) ,
      @sCod_Cta CHAR(6) ,
      @sCod_Caja CHAR(6) ,
      @smov_num_c CHAR(20) ,
      @deTotal_Efec DECIMAL(18, 5) ,
      @iChe_Dev INT ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @sdFecCom SMALLDATETIME = NULL ,
      @iNumCom INT = NULL ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @deTasa DECIMAL(21, 8) ,
      @bActivado BIT ,
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
      @sCo_Sucu_In CHAR(6) ,
      @sCo_Us_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
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

        INSERT  INTO saDepositoBanco
                ( dep_num, deposito, fecha, mov_num_b, cod_cta, cod_caja, mov_num_c, total_efec, 
		/*total_cheq, total_tarj,*/ che_dev, co_cta_ingr_egr, feccom, numcom, dis_cen, tasa, aux01, aux02, campo1,
                  campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_sucu_in, co_us_in, fe_us_in, co_sucu_mo,
                  co_us_mo, fe_us_mo, revisado, trasnfe, activado )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sDep_Num, @sDeposito, @sdFecha, @smov_num_b, @sCod_Cta, @sCod_Caja, @smov_num_c, @deTotal_Efec,
		/*@deTotal_Cheq, @deTotal_Tarj,*/ @iChe_Dev, @sCo_Cta_Ingr_Egr, @sdFecCom, @iNumCom, @sDis_Cen, @deTasa,
                  @deAux01, @sAux02, @sCampo1, @sCampo2, @sCampo3, @sCampo
```
